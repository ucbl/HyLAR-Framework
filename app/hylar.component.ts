import { Component, Input } from '@angular/core';
import { FileSelectDirective, FileDropDirective, FileUploader } from 'ng2-file-upload/ng2-file-upload';
import { Http, Headers, Response, Request } from '@angular/http';
import { Observable } from 'rxjs/Rx';
import { AdaptationService } from './adaptation.service';
import { RemoteService } from './remote.service';
import 'rxjs/Rx';

declare var Hylar: any, Logics: any, navigator: any;

class HConfig {
    static server = "server";
    static client = "client";
    static auto = "auto";   
}

class Parameters {
    ontologySize: Number; batteryLevel: Number; ping: Number;
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
    @Input() thresholds = new Parameters();


    current = new Parameters();
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

        this.thresholds = {
            ontologySize: 200,
            batteryLevel: 0.5,
            ping: 100
        }

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
        let processingDelay = new Date().getTime(), that:any, request:any;
        this.updateHylarRules();
        this.postLog(`SPARQL query '${this.sparqlQuery.substr(0,10)}...' sent.`);
        switch (this.configuration.querying) {
            case HConfig.client:
                return this.hylarClient
                    .query(this.sparqlQuery)
                    .then((results) => {
                        processingDelay = new Date().getTime() - processingDelay;   
                        if (results[0] && results[0] === true) {
                            this.postLog(`Updated completed on the client side in ${processingDelay} ms.`);
                        } else {                            
                            this.postLog(`Finished, ${ results.length } results found on the client in ${processingDelay} ms.`);
                        }
                        this.results = results;
                    }).fail((ex) => {
                        this.postLog(ex);
                    });
            case HConfig.server:
                that = this;
                new RemoteService(this.http).getServerTime(this.getHylarServerAddress(`time`), function(time) {
                    request = that.http                
                        .post(that.getHylarServerAddress(`query?time=${time}`), {
                                query: that.sparqlQuery
                            });

                    request
                        .map((res:Response) => res.json())
                        .subscribe(res => {                                   
                                that.postLog(`Request delay: ${res.requestDelay}`);
                                that.postLog(`Response delay: ${new Date().getTime() - res.serverTime}`);
                                if (res.data[0] && res.data[0] === true) {
                                    that.postLog(`Updated completed on the server-side in ${res.processingDelay} ms.`);
                                } else {  
                                    that.postLog(`Finished, ${ res.data.length } results found on the server in ${res.processingDelay} ms`);
                                }
                                that.results = res.data;
                            });

                    request.catch(error => {
                        that.postLog(error);
                        return Observable.throw(error.json());
                    });
                });
                break;
            case HConfig.auto:       
                let timeNow:number, headers = new Headers();
                that = this;
                headers.append('Accept', 'application/json');

                new RemoteService(this.http).getServerTime(this.getHylarServerAddress(`time`), function(time) {
                    timeNow = time;
                    request = that.http                
                        .get(that.getHylarServerAddress(`time`), {
                            headers: headers
                        });

                    request
                        .map((res:Response) => res.json())
                        .subscribe(res => {
                            that.current.ping = parseInt(res.ms) - timeNow;
                            setTimeout(function() {
                                that.hylarClient.query("CONSTRUCT WHERE { ?s ?p ?o }").then(function(res) {
                                    that.current.ontologySize = res.triples.length;         
                                    navigator.getBattery().then(function(battery) {
                                        that.current.batteryLevel = battery.level;
                                        new AdaptationService().getReasoningLocations(that.thresholds, that.current, function(results){
                                            that.postLog(`The ontology contains ${that.current.ontologySize} triples, the
                                                            ping is ${that.current.ping} and
                                                            the battery level is ${that.current.batteryLevel}.`);
                                            that.postLog(`Querying on the ${results.querying}-side.`);
                                            that.configuration.querying = results.querying;
                                            that.sparql();
                                        });
                                    });                              
                                });
                            }, 200)
                            
                        });                  

                    request.catch(error => {
                        that.postLog(error);
                        return Observable.throw(error.json());
                    });
                });                    
                break;
            default: 
                this.postLog(`Expected either client or server configuration, none found.`);
        }
    }

    public classify(filename:String) {   
        let request:Observable<Response>, headers:Headers, current:any, processingDelay:number, that:any;
        this.updateHylarRules();
        switch (this.configuration.classification) {
            case HConfig.client:
                headers = new Headers();
                headers.append('Accept', 'application/json'); 

                request = this.http                
                    .get(this.getHylarServerAddress(`ontology/${filename}`), {
                        headers: headers
                    });

                request
                    .map((ontology:Response) => ontology.json())
                    .subscribe(ontology => {
                        this.postLog(`${filename} successfully retrieved. Starting client-side classification.`);
                        processingDelay = new Date().getTime();
                        return this.hylarClient
                            .load(ontology.data.ontologyTxt, ontology.data.mimeType, null, null, true)
                            .then((result) => {   
                                processingDelay = new Date().getTime() - processingDelay;
                                this.postLog(`Classification succeeded in ${processingDelay} ms.`);  
                                this.triggerOkState('classification');                              
                            }).fail((ex) => {
                                this.postLog(ex);
                            });
                    });

                request.catch(error => {
                    this.postLog(error);
                    return Observable.throw(error.json());
                });

                break;
            case HConfig.server:
                that = this;
                new RemoteService(this.http).getServerTime(this.getHylarServerAddress(`time`), function(time) {
                    request = that.http                
                    .get(that.getHylarServerAddress(`classifyRemotely/${filename}?time=${time}`));

                    request
                        .map((res:Response) => res.json())
                        .subscribe(res => {
                            that.postLog(`Request delay: ${res.requestDelay}`);
                            that.postLog(`Response delay: ${new Date().getTime() - res.serverTime}`);
                            that.postLog(`${filename} successfully classified on the server-side in ${res.processingDelay} ms.`);
                            that.hylarClient
                                .import(res.dictionary.dict)
                                .then((result) => {   
                                    that.postLog(`Import succeeded.`);  
                                    that.triggerOkState('classification');                              
                                }).catch((ex) => {
                                    that.postLog(ex);
                                });
                        });

                    request.catch(error => {
                        that.postLog(error);
                        return Observable.throw(error.json());
                    });
                })                
                break;
            case HConfig.auto:       
                let timeNow:Number;
                that = this;    
                headers = new Headers();
                headers.append('Accept', 'application/json');

                new RemoteService(this.http).getServerTime(this.getHylarServerAddress(`time`), function(time) {
                    timeNow = time;
                    request = that.http                
                        .get(that.getHylarServerAddress(`ontology/${filename}?time=${timeNow}`), {
                            headers: headers
                        });

                    request
                        .map((ontology:Response) => ontology.json())
                        .subscribe(ontology => {
                            let tmpStorage = new Hylar().sm.storage;
                            setTimeout(function() {
                                tmpStorage.load(ontology.data.mimeType, ontology.data.ontologyTxt, function(err, ok) {
                                    tmpStorage.execute("CONSTRUCT WHERE { ?s ?p ?o }", function(err, res) {                                                                        
                                        that.current.ping = ontology.requestDelay;
                                        that.current.ontologySize = res.triples.length;         
                                        navigator.getBattery().then(function(battery) {
                                            that.current.batteryLevel = battery.level;
                                            new AdaptationService().getReasoningLocations(that.thresholds, that.current, function(results){
                                                that.postLog(`The ontology contains ${that.current.ontologySize} triples, the
                                                                ping is ${that.current.ping} and
                                                                the battery level is ${that.current.batteryLevel}.`);
                                                that.postLog(`Classification on the ${results.classification}-side.`);
                                                that.configuration.classification = results.classification;
                                                that.classify(filename);
                                            });
                                        })                               
                                    })
                                });
                            }, 200)
                            
                        });                  

                    request.catch(error => {
                        that.postLog(error);
                        return Observable.throw(error.json());
                    });
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

    public updateHylarRules() {
        if (localStorage.getItem("rules")) {
            let stringRules = [];
            for(let rule of JSON.parse(localStorage.getItem("rules"))) {
                if (rule.activated) {
                    stringRules.push(rule.rule)                 
                }                
            }
            this.hylarClient.rules = Logics.parseRules(stringRules);
        }        
    }

    public insertDataset() {
        this.sparqlQuery = `INSERT DATA {
            <http://www.apple.com/product/iPad3> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#ProductOrService> .
            <http://www.apple.com/product/iPad3> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.my-online-store.fr/Tablet> .
            <http://www.apple.com/product/iPad3> <http://purl.org/goodrelations/v1#hasBrand> <http://www.apple.com/Apple> .
            <http://www.apple.com/Apple> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#Brand> .
            <http://components.org/4G> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://ns.inria.fr/provoc#Component> .
            <http://www.parisleshalles.fr/stores/FNAC> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#BusinessEntity> .
            <http://www.parisleshalles.fr/stores/FNAC> <http://purl.org/goodrelations/v1#hasBrand> <http://www.samsung.com/Samsung> .
            <http://www.parisleshalles.fr/stores/FNAC> <http://purl.org/goodrelations/v1#hasPOS> <http://www.parisleshalles.fr/stores/FNAC/location> .
            <http://www.parisleshalles.fr/stores/FNAC> <http://purl.org/goodrelations/v1#offers> <http://www.parisleshalles.fr/stores/FNAC/offering/GalaxyTab4> .
            <http://www.parisleshalles.fr/stores/FNAC> <http://purl.org/goodrelations/v1#offers> <http://www.parisleshalles.fr/stores/FNAC/offering/GalaxyTab4_4G> .
            <http://www.samsung.com/Samsung> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#Brand> .
            <http://www.parisleshalles.fr/stores/FNAC/location> <http://schema.org/place> <http://fr.dbpedia.org/page/Paris> .
            <http://www.parisleshalles.fr/stores/FNAC/offering/GalaxyTab4> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#Offering> .
            <http://www.parisleshalles.fr/stores/FNAC/offering/GalaxyTab4> <http://purl.org/goodrelations/v1#includes> <http://www.samsung.com/GalaxyTab4> .
            <http://www.parisleshalles.fr/stores/FNAC/offering/GalaxyTab4_4G> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#Offering> .
            <http://www.parisleshalles.fr/stores/FNAC/offering/GalaxyTab4_4G> <http://purl.org/goodrelations/v1#includes> <http://www.samsung.com/GalaxyTab4_4G> .
            <http://www.samsung.com/GalaxyTab4> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.my-online-store.fr/Tablet> .
            <http://www.samsung.com/GalaxyTab4> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#ProductOrService> .
            <http://purl.org/goodrelations/v1#Location> <http://www.w3.org/2002/07/owl#sameAs> <http://schema.org/Place> .
            <http://www.parisleshalles.fr/stores/FNAC/offering/iPad3> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#Offering> .
            <http://www.parisleshalles.fr/stores/FNAC/offering/iPad3> <http://purl.org/goodrelations/v1#includes> <http://www.parisleshalles.fr/stores/FNAC/iPad3> .
            <http://fr.dbpedia.org/page/Paris> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Place> .
            <http://www.samsung.com/GalaxyTab4_4G> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.my-online-store.fr/Tablet> .
            <http://www.samsung.com/GalaxyTab4_4G> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#ProductOrService> .
            <http://www.samsung.com/GalaxyTab4_4G> <http://ns.inria.fr/provoc#hasComponent> <http://components.org/4G> .
            <http://www.samsung.com/GalaxyTab4_4G> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <http://www.samsung.com/GalaxyTab4> .
            <http://www.parisleshalles.fr/stores/AppleStore/offering/iPad3> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#Offering> .
            <http://www.parisleshalles.fr/stores/AppleStore/offering/iPad3> <http://purl.org/goodrelations/v1#includes> <http://www.apple.com/product/iPad3> .
            <http://www.parisleshalles.fr/stores/AppleStore/location> <http://schema.org/place> <http://fr.dbpedia.org/page/Paris> .
            <http://www.parisleshalles.fr/stores/AppleStore> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/goodrelations/v1#BusinessEntity> .
            <http://www.parisleshalles.fr/stores/AppleStore> <http://purl.org/goodrelations/v1#hasBrand> <http://www.apple.com/Apple> .
            <http://www.parisleshalles.fr/stores/AppleStore> <http://purl.org/goodrelations/v1#hasPOS> <http://www.parisleshalles.fr/stores/AppleStore/location> .
            <http://www.parisleshalles.fr/stores/AppleStore> <http://purl.org/goodrelations/v1#offers> <http://www.parisleshalles.fr/stores/AppleStore/offering/iPad3> .
        }`;
    };

    public insertComplexSelect() {
        this.sparqlQuery = `PREFIX vocab: <http://www.my-online-store.fr/> 
    PREFIX pv: <http://ns.inria.fr/provoc#> 
    PREFIX gr: <http://purl.org/goodrelations/v1#> 
    PREFIX schema: <http://schema.org/> 

    SELECT ?product ?store { 
        # Je veux une tablette 4G 
        ?product a vocab:Tablet . 
        ?product pv:hasComponent <http://components.org/4G> . 
        
        # Proposée par un magasin ... 
        ?store gr:offers ?offer .  
        ?offer gr:includes ?product . 
        
        # ... localisé à Paris
        ?store gr:hasPOS ?location . 
        ?location schema:place <http://fr.dbpedia.org/page/Paris> . 
    }`
    };

    public insertSmallerSelect() {
        this.sparqlQuery = `PREFIX vocab: <http://www.my-online-store.fr/> 
PREFIX pv: <http://ns.inria.fr/provoc#> 
PREFIX gr: <http://purl.org/goodrelations/v1#> 
PREFIX schema: <http://schema.org/> 
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?product ?store { 
   # Je veux une tablette 4G 
   ?product a vocab:Tablet . 
   ?product pv:hasComponent <http://components.org/4G> . 
 
   # Proposée par un magasin ... 
   ?store gr:offers ?offer .  
   ?offer gr:includes ?product . 
 
   # ... localisé à Paris
   ?store vocab:isNearBy xsd:true . 
}`
    }
}
