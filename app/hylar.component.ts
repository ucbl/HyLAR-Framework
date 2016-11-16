import { Component, Input } from '@angular/core';
import { FileSelectDirective, FileDropDirective, FileUploader } from 'ng2-file-upload/ng2-file-upload';
import { Http, Headers, Response, Request } from '@angular/http';
import { Observable } from 'rxjs/Rx';
import 'rxjs/Rx';

declare var Hylar: any;

class HConfig {
    static server = "server";
    static client = "client";
    static auto = "auto";   
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

    state: {
        upload: Boolean, classification: Boolean, delete: Boolean
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
        this.sparqlQuery = `SELECT * { ?s ?p ?o } LIMIT 100`;
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

        this.state = {
            upload: false,
            classification: false,
            delete: false
        }

        this.uploader = new FileUploader({
            url: this.getHylarServerAddress("ontology"),
            autoUpload: true            
        });

        this.uploader.onBeforeUploadItem = (item) => {
            item.withCredentials = false;
        };

        this.uploader.onSuccessItem = (item) => {            
            that.postLog(`${item._file.name} successfully uploaded.`);
            this.triggerOkState("upload");
            this.updateFileList();
        }

        this.uploader.onErrorItem = (item) => {            
            that.postLog(`Problem encountered when uploading ${item._file.name}.`);
        }

        this.updateFileList();
        this.postLog(`HyLAR-Framework is now ready.`);
    };

    public triggerOkState(action:any) {
        this.state[action] = true;
        setTimeout(() => {
            this.state[action] = false;
        }, 1000);
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
                        if (results[0] && results[0] === true) {
                            this.postLog(`Updated completed.`);
                        } else {
                            this.postLog(`Finished, ${ results.length } results found`);
                        }
                        this.results = results;
                    }).catch((ex) => {
                        this.postLog(ex);
                    });
                break;
            case HConfig.server:
                let request = this.http                
                    .post(this.getHylarServerAddress(`query`), {
                            query: this.sparqlQuery
                        });

                request
                    .map((res:Response) => res.json())
                    .subscribe(res => { 
                            if (res.data[0] && res.data[0] === true) {
                                this.postLog(`Updated completed.`);
                            } else {  
                                this.postLog(`Finished, ${ res.data.length } results found`);
                            }
                            this.results = res.data;
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

    public classify(filename:String) {   
        let request:Observable<Response>;

        switch (this.configuration.classification) {
            case HConfig.client:
                let headers = new Headers();
                headers.append('Accept', 'application/json'); 

                request = this.http                
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
                                this.triggerOkState('classification');                              
                            }).catch((ex) => {
                                this.postLog(ex);
                            });
                    });

                request.catch(error => {
                    this.postLog(error);
                    return Observable.throw(error.json());
                });

                break;
            case HConfig.server:
                request = this.http                
                    .get(this.getHylarServerAddress(`classifyRemotely/${filename}`));

                request
                    .map((res:Response) => res.json())
                    .subscribe(res => {
                        this.postLog(`${filename} successfully classified on the server-side.`);
                        this.hylarClient
                            .import(res.dictionary.dict)
                            .then((result) => {   
                                this.postLog(`Import succeeded.`);  
                                this.triggerOkState('classification');                              
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

    public delete(filename:String) {
        let request = this.http                
                    .get(this.getHylarServerAddress(`remove/${filename}`));

                request
                    .map((res:Response) => res.text())
                    .subscribe(res => {
                        this.postLog(`${filename} successfully deleted.`);
                        this.updateFileList();
                        this.triggerOkState("delete");
                    });

                request.catch(error => {
                    this.postLog(error);
                    return Observable.throw(error.json());
                });
    }

    public clear() {
        this.hylarClient = new Hylar();
        this.postLog(`HyLAR has been cleared.`);
    }
}
