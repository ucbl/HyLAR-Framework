import { Component } from '@angular/core';
import { HylarServerComponent } from './hylar.server.component';
import { FileUploader } from 'ng2-file-upload/ng2-file-upload';
declare var Hylar: any;

@Component({
    selector: 'hylar',
    templateUrl: '../hylar.html'
})

export class HylarComponent { 
    sparqlQuery: String;    
    client: Object;
    server: HylarServerComponent;
    localOntology: String;
    uploader:FileUploader = new FileUploader({url: "localhost:3002/ontology"});
    
    constructor() {
        this.client = new Hylar();
        this.localOntology = localStorage.getItem('ontology');
        this.sparqlQuery = "SELECT * { ?s ?p ?o }";
    };
}
