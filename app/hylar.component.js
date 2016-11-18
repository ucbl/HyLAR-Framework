"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require('@angular/core');
var ng2_file_upload_1 = require('ng2-file-upload/ng2-file-upload');
var http_1 = require('@angular/http');
var Rx_1 = require('rxjs/Rx');
var adaptation_service_1 = require('./adaptation.service');
var remote_service_1 = require('./remote.service');
require('rxjs/Rx');
var HConfig = (function () {
    function HConfig() {
    }
    HConfig.server = "server";
    HConfig.client = "client";
    HConfig.auto = "auto";
    return HConfig;
}());
var Parameters = (function () {
    function Parameters() {
    }
    return Parameters;
}());
var HylarComponent = (function () {
    function HylarComponent(http) {
        var _this = this;
        this.http = http;
        this.thresholds = new Parameters();
        this.current = new Parameters();
        this.remoteHost = "localhost";
        this.remotePort = 3002;
        var that = this;
        this.hylarClient = new Hylar();
        this.localOntology = localStorage.getItem('ontology');
        this.sparqlQuery = "SELECT * { ?s ?p ?o } LIMIT 100";
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
        };
        this.state = {
            upload: false,
            classification: false,
            delete: false
        };
        this.uploader = new ng2_file_upload_1.FileUploader({
            url: this.getHylarServerAddress("ontology"),
            autoUpload: true
        });
        this.uploader.onBeforeUploadItem = function (item) {
            item.withCredentials = false;
        };
        this.uploader.onSuccessItem = function (item) {
            that.postLog(item._file.name + " successfully uploaded.");
            _this.triggerOkState("upload");
            _this.updateFileList();
        };
        this.uploader.onErrorItem = function (item) {
            that.postLog("Problem encountered when uploading " + item._file.name + ".");
        };
        this.updateFileList();
        this.postLog("HyLAR-Framework is now ready.");
    }
    ;
    HylarComponent.prototype.triggerOkState = function (action) {
        var _this = this;
        this.state[action] = true;
        setTimeout(function () {
            _this.state[action] = false;
        }, 1000);
    };
    ;
    HylarComponent.prototype.getHylarServerAddress = function (command) {
        return "http://" + this.remoteHost + ":" + this.remotePort + "/" + command;
    };
    HylarComponent.prototype.postLog = function (message) {
        this.log.unshift([new Date().toUTCString(), message]);
    };
    ;
    HylarComponent.prototype.updateFileList = function () {
        var _this = this;
        var request = this.http
            .get(this.getHylarServerAddress("ontology"));
        request
            .map(function (values) { return values.json(); })
            .subscribe(function (values) {
            _this.postLog("Successfully retrieved server file list.");
            _this.ontologyFiles = values;
        });
        request.catch(function (error) {
            _this.postLog(error);
            return Rx_1.Observable.throw(error.json());
        });
    };
    HylarComponent.prototype.sparql = function () {
        var _this = this;
        var processingDelay = new Date().getTime(), that, request;
        this.postLog("SPARQL query '" + this.sparqlQuery.substr(0, 10) + "...' sent.");
        switch (this.configuration.querying) {
            case HConfig.client:
                this.hylarClient
                    .query(this.sparqlQuery)
                    .then(function (results) {
                    processingDelay = new Date().getTime() - processingDelay;
                    if (results[0] && results[0] === true) {
                        _this.postLog("Updated completed on the client side in " + processingDelay + " ms.");
                    }
                    else {
                        _this.postLog("Finished, " + results.length + " results found on the client in " + processingDelay + " ms.");
                    }
                    _this.results = results;
                }).catch(function (ex) {
                    _this.postLog(ex);
                });
                break;
            case HConfig.server:
                that = this;
                new remote_service_1.RemoteService(this.http).getServerTime(this.getHylarServerAddress("time"), function (time) {
                    request = that.http
                        .post(that.getHylarServerAddress("query?time=" + time), {
                        query: that.sparqlQuery
                    });
                    request
                        .map(function (res) { return res.json(); })
                        .subscribe(function (res) {
                        that.postLog("Request delay: " + res.requestDelay);
                        that.postLog("Response delay: " + (new Date().getTime() - res.serverTime));
                        if (res.data[0] && res.data[0] === true) {
                            that.postLog("Updated completed on the server-side in " + res.processingDelay + " ms.");
                        }
                        else {
                            that.postLog("Finished, " + res.data.length + " results found on the server in " + res.processingDelay + " ms");
                        }
                        that.results = res.data;
                    });
                    request.catch(function (error) {
                        that.postLog(error);
                        return Rx_1.Observable.throw(error.json());
                    });
                });
                break;
            case HConfig.auto:
                var timeNow_1, headers_1 = new http_1.Headers();
                that = this;
                headers_1.append('Accept', 'application/json');
                new remote_service_1.RemoteService(this.http).getServerTime(this.getHylarServerAddress("time"), function (time) {
                    timeNow_1 = time;
                    request = that.http
                        .get(that.getHylarServerAddress("time"), {
                        headers: headers_1
                    });
                    request
                        .map(function (res) { return res.json(); })
                        .subscribe(function (res) {
                        that.current.ping = parseInt(res.ms) - timeNow_1;
                        setTimeout(function () {
                            that.hylarClient.query("CONSTRUCT WHERE { ?s ?p ?o }").then(function (res) {
                                that.current.ontologySize = res.triples.length;
                                navigator.getBattery().then(function (battery) {
                                    that.current.batteryLevel = battery.level;
                                    new adaptation_service_1.AdaptationService().getReasoningLocations(that.thresholds, that.current, function (results) {
                                        that.postLog("The ontology contains " + that.current.ontologySize + " triples, the\n                                                            ping is " + that.current.ping + " and\n                                                            the battery level is " + that.current.batteryLevel + ".");
                                        that.postLog("Querying on the " + results.querying + "-side.");
                                        that.configuration.querying = results.querying;
                                        that.sparql();
                                    });
                                });
                            });
                        }, 200);
                    });
                    request.catch(function (error) {
                        that.postLog(error);
                        return Rx_1.Observable.throw(error.json());
                    });
                });
                break;
            default:
                this.postLog("Expected either client or server configuration, none found.");
        }
    };
    HylarComponent.prototype.classify = function (filename) {
        var _this = this;
        var request, headers, current, processingDelay, that;
        switch (this.configuration.classification) {
            case HConfig.client:
                headers = new http_1.Headers();
                headers.append('Accept', 'application/json');
                request = this.http
                    .get(this.getHylarServerAddress("ontology/" + filename), {
                    headers: headers
                });
                request
                    .map(function (ontology) { return ontology.json(); })
                    .subscribe(function (ontology) {
                    _this.postLog(filename + " successfully retrieved. Starting client-side classification.");
                    processingDelay = new Date().getTime();
                    _this.hylarClient
                        .load(ontology.data.ontologyTxt, ontology.data.mimeType, null, null, true)
                        .then(function (result) {
                        processingDelay = new Date().getTime() - processingDelay;
                        _this.postLog("Classification succeeded in " + processingDelay + " ms.");
                        _this.triggerOkState('classification');
                    }).catch(function (ex) {
                        _this.postLog(ex);
                    });
                });
                request.catch(function (error) {
                    _this.postLog(error);
                    return Rx_1.Observable.throw(error.json());
                });
                break;
            case HConfig.server:
                that = this;
                new remote_service_1.RemoteService(this.http).getServerTime(this.getHylarServerAddress("time"), function (time) {
                    request = that.http
                        .get(that.getHylarServerAddress("classifyRemotely/" + filename + "?time=" + time));
                    request
                        .map(function (res) { return res.json(); })
                        .subscribe(function (res) {
                        that.postLog("Request delay: " + res.requestDelay);
                        that.postLog("Response delay: " + (new Date().getTime() - res.serverTime));
                        that.postLog(filename + " successfully classified on the server-side in " + res.processingDelay + " ms.");
                        that.hylarClient
                            .import(res.dictionary.dict)
                            .then(function (result) {
                            that.postLog("Import succeeded.");
                            that.triggerOkState('classification');
                        }).catch(function (ex) {
                            that.postLog(ex);
                        });
                    });
                    request.catch(function (error) {
                        that.postLog(error);
                        return Rx_1.Observable.throw(error.json());
                    });
                });
                break;
            case HConfig.auto:
                var timeNow_2;
                that = this;
                headers = new http_1.Headers();
                headers.append('Accept', 'application/json');
                new remote_service_1.RemoteService(this.http).getServerTime(this.getHylarServerAddress("time"), function (time) {
                    timeNow_2 = time;
                    request = that.http
                        .get(that.getHylarServerAddress("ontology/" + filename + "?time=" + timeNow_2), {
                        headers: headers
                    });
                    request
                        .map(function (ontology) { return ontology.json(); })
                        .subscribe(function (ontology) {
                        var tmpStorage = new Hylar().sm.storage;
                        setTimeout(function () {
                            tmpStorage.load(ontology.data.mimeType, ontology.data.ontologyTxt, function (err, ok) {
                                tmpStorage.execute("CONSTRUCT WHERE { ?s ?p ?o }", function (err, res) {
                                    that.current.ping = ontology.requestDelay;
                                    that.current.ontologySize = res.triples.length;
                                    navigator.getBattery().then(function (battery) {
                                        that.current.batteryLevel = battery.level;
                                        new adaptation_service_1.AdaptationService().getReasoningLocations(that.thresholds, that.current, function (results) {
                                            that.postLog("The ontology contains " + that.current.ontologySize + " triples, the\n                                                                ping is " + that.current.ping + " and\n                                                                the battery level is " + that.current.batteryLevel + ".");
                                            that.postLog("Classification on the " + results.classification + "-side.");
                                            that.configuration.classification = results.classification;
                                            that.classify(filename);
                                        });
                                    });
                                });
                            });
                        }, 200);
                    });
                    request.catch(function (error) {
                        that.postLog(error);
                        return Rx_1.Observable.throw(error.json());
                    });
                });
                break;
            default:
                this.postLog("Expected either client or server configuration, none found.");
        }
    };
    HylarComponent.prototype.delete = function (filename) {
        var _this = this;
        var request = this.http
            .get(this.getHylarServerAddress("remove/" + filename));
        request
            .map(function (res) { return res.text(); })
            .subscribe(function (res) {
            _this.postLog(filename + " successfully deleted.");
            _this.updateFileList();
            _this.triggerOkState("delete");
        });
        request.catch(function (error) {
            _this.postLog(error);
            return Rx_1.Observable.throw(error.json());
        });
    };
    HylarComponent.prototype.clear = function () {
        this.hylarClient = new Hylar();
        this.postLog("HyLAR has been cleared.");
    };
    __decorate([
        core_1.Input(), 
        __metadata('design:type', String)
    ], HylarComponent.prototype, "sparqlQuery", void 0);
    __decorate([
        core_1.Input(), 
        __metadata('design:type', Array)
    ], HylarComponent.prototype, "ontologyFiles", void 0);
    __decorate([
        core_1.Input(), 
        __metadata('design:type', String)
    ], HylarComponent.prototype, "reasoningMethod", void 0);
    __decorate([
        core_1.Input(), 
        __metadata('design:type', Object)
    ], HylarComponent.prototype, "configuration", void 0);
    __decorate([
        core_1.Input(), 
        __metadata('design:type', Object)
    ], HylarComponent.prototype, "thresholds", void 0);
    HylarComponent = __decorate([
        core_1.Component({
            selector: 'hylar',
            templateUrl: '../hylar.html'
        }), 
        __metadata('design:paramtypes', [http_1.Http])
    ], HylarComponent);
    return HylarComponent;
}());
exports.HylarComponent = HylarComponent;
//# sourceMappingURL=hylar.component.js.map