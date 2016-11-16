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
require('rxjs/Rx');
var HConfig = (function () {
    function HConfig() {
    }
    HConfig.server = "server";
    HConfig.client = "client";
    HConfig.auto = "auto";
    return HConfig;
}());
var HylarComponent = (function () {
    function HylarComponent(http) {
        var _this = this;
        this.http = http;
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
        this.postLog("SPARQL query '" + this.sparqlQuery.substr(0, 10) + "...' sent to the " + this.configuration.querying + ".");
        switch (this.configuration.querying) {
            case HConfig.client:
                this.hylarClient
                    .query(this.sparqlQuery)
                    .then(function (results) {
                    if (results[0] && results[0] === true) {
                        _this.postLog("Updated completed.");
                    }
                    else {
                        _this.postLog("Finished, " + results.length + " results found");
                    }
                    _this.results = results;
                }).catch(function (ex) {
                    _this.postLog(ex);
                });
                break;
            case HConfig.server:
                var request = this.http
                    .post(this.getHylarServerAddress("query"), {
                    query: this.sparqlQuery
                });
                request
                    .map(function (res) { return res.json(); })
                    .subscribe(function (res) {
                    if (res.data[0] && res.data[0] === true) {
                        _this.postLog("Updated completed.");
                    }
                    else {
                        _this.postLog("Finished, " + res.data.length + " results found");
                    }
                    _this.results = res.data;
                });
                request.catch(function (error) {
                    _this.postLog(error);
                    return Rx_1.Observable.throw(error.json());
                });
                break;
            default:
                this.postLog("Expected either client or server configuration, none found.");
        }
    };
    HylarComponent.prototype.classify = function (filename) {
        var _this = this;
        var request;
        switch (this.configuration.classification) {
            case HConfig.client:
                var headers = new http_1.Headers();
                headers.append('Accept', 'application/json');
                request = this.http
                    .get(this.getHylarServerAddress("ontology/" + filename), {
                    headers: headers
                });
                request
                    .map(function (ontology) { return ontology.json(); })
                    .subscribe(function (ontology) {
                    _this.postLog(filename + " successfully retrieved. Starting client-side classification.");
                    _this.hylarClient
                        .load(ontology.data.ontologyTxt, ontology.data.mimeType, null, null, true)
                        .then(function (result) {
                        _this.postLog("Classification succeeded.");
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
                request = this.http
                    .get(this.getHylarServerAddress("classifyRemotely/" + filename));
                request
                    .map(function (res) { return res.json(); })
                    .subscribe(function (res) {
                    _this.postLog(filename + " successfully classified on the server-side.");
                    _this.hylarClient
                        .import(res.dictionary.dict)
                        .then(function (result) {
                        _this.postLog("Import succeeded.");
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