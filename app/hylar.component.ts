import { Component, Input } from '@angular/core';
import { FileSelectDirective, FileDropDirective, FileUploader } from 'ng2-file-upload/ng2-file-upload';
import { Http, Headers, Response } from '@angular/http';
import {Observable} from 'rxjs/Rx';
import 'rxjs/Rx';

declare var Hylar: any;

class HConfig {
    static server = "server";
    static client = "client";    
}

@Component({
    selector: 'hylar',
    templateUrl: '../hylar.html'
})

export class HylarComponent {  
    @Input() public sparqlQuery: String;
    @Input() public ontologyFiles: Array<any>;
    @Input() reasoningMethod: String;    
    @Input() configuration: {
        classification: HConfig, querying: HConfig
    };

    hylarClient: any;
    remoteHost = "localhost";
    remotePort = 3002;

    localOntology: String;    
    uploader: FileUploader;

    log: Array<[String,String]>;    
    results: Array<any>;
    
    constructor(private http: Http) {     
        let that = this;

        this.hylarClient = new Hylar();
        this.localOntology = localStorage.getItem('ontology');
        this.sparqlQuery = `SELECT * { ?s ?p ?o }`;
        this.log = [];
        this.results = [];

        /*window.onerror = (error:any) => {
            that.postLog(error);
        }

        console.log = (message:String) => {
            that.postLog(message);                   
        };*/
        
        this.configuration = {
            classification: HConfig.client,
            querying: HConfig.client
        };

        this.uploader = new FileUploader({
            url: this.getHylarServerAddress("ontology"),
            autoUpload: true            
        });

        this.uploader.onBeforeUploadItem = (item) => {
            item.withCredentials = false;
        };

        this.uploader.onSuccessItem = (item) => {            
            that.postLog(`${item._file.name} successfully uploaded.`);
            this.updateFileList();
        }

        this.uploader.onErrorItem = (item) => {            
            that.postLog(`Problem encountered when uploading ${item._file.name}.`);
        }

        this.updateFileList();
        this.postLog(`HyLAR-Framework is now ready.`);
    };

    public getHylarServerAddress(command: String) {
        return `http://${this.remoteHost}:${this.remotePort}/${command}`;
    }

    public postLog(message:String) {
        this.log.unshift([new Date().toUTCString(), message]);
    };

    public updateFileList() {
        let request = this.http
            .get(this.getHylarServerAddress("ontology"));

        request
            .map((values:Response) => values.json())
            .subscribe(values => {
                this.postLog(`Successfully retrieved server file list.`);
                this.ontologyFiles = values;
            });

        request.catch(error => {
            this.postLog(error);
            return Observable.throw(error.json());
        });
    }

    public sparql() {
        this.postLog(`SPARQL query '${this.sparqlQuery.substr(0,10)}...' sent to the ${this.configuration.querying}.`);
        switch (this.configuration.querying) {
            case HConfig.client:
                this.hylarClient
                    .query(this.sparqlQuery)
                    .then((results) => {   
                        this.postLog(`Finished, ${ results.length } results found`);
                        this.results = results;
                    }).catch((ex) => {
                        this.postLog(ex);
                    });
                break;
            default: 
                this.postLog(`Expected either client or server configuration, none found.`);
        }
    }

    public classify(filename:String) {        
        switch (this.configuration.classification) {
            case HConfig.client:
                let headers = new Headers();
                headers.append('Accept', 'application/json'); 

                let request = this.http                
                    .get(this.getHylarServerAddress(`ontology/${filename}`), {
                        headers: headers
                    });

                request
                    .map((ontology:Response) => ontology.json())
                    .subscribe(ontology => {
                        this.postLog(`${filename} successfully retrieved. Starting client-side classification.`);
                        this.hylarClient
                            .load(ontology.data.ontologyTxt, ontology.data.mimeType, null, null, true)
                            .then((result) => {   
                                this.postLog(`Classification succeeded.`);                                
                            }).catch((ex) => {
                                this.postLog(ex);
                            });
                    });

                request.catch(error => {
                    this.postLog(error);
                    return Observable.throw(error.json());
                });

                break;
            default:
                this.postLog(`Expected either client or server configuration, none found.`);
        }
    }

    public clear() {
        this.hylarClient = new Hylar();
        this.postLog(`HyLAR has been cleared.`);
    }
}