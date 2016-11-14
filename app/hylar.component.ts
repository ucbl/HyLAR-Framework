import { Component } from '@angular/core';
import { HylarServerComponent } from './hylar.server.component';
import { FileUploader } from 'ng2-file-upload/ng2-file-upload';
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
    sparqlQuery: String;    
    client: any;
    server: HylarServerComponent;
    localOntology: String;    
    uploader: FileUploader;
    log: Array<[String,String]>;
    configuration: {
        classification: HConfig, querying: HConfig
    };
    results: Array<any>;
    
    constructor() {
        this.client = new Hylar();
        this.localOntology = localStorage.getItem('ontology');
        this.sparqlQuery = `SELECT * { ?s ?p ?o }`;
        this.log = [];
        
        this.configuration = {
            classification: HConfig.client,
            querying: HConfig.client
        };

        this.uploader = new FileUploader({url: "localhost:3002/ontology"});
        this.postLog(`HyLAR-Framework is now ready.`);
    };

    public postLog(message:String) {
        this.log.unshift([new Date().toUTCString(), message]);
    };

    public sparql() {
        this.postLog(`SPARQL query '${ this.sparqlQuery.substr(0,10) }...' sent to the ${ this.configuration.querying }.`);
        switch (this.configuration.querying) {
            case HConfig.client:
                this.client
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
}
