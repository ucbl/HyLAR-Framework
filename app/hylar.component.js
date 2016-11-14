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
var HConfig = (function () {
    function HConfig() {
    }
    HConfig.server = "server";
    HConfig.client = "client";
    return HConfig;
}());
var HylarComponent = (function () {
    function HylarComponent() {
        this.client = new Hylar();
        this.localOntology = localStorage.getItem('ontology');
        this.sparqlQuery = "SELECT * { ?s ?p ?o }";
        this.log = [];
        this.configuration = {
            classification: HConfig.client,
            querying: HConfig.client
        };
        this.uploader = new ng2_file_upload_1.FileUploader({ url: "localhost:3002/ontology" });
        this.postLog("HyLAR-Framework is now ready.");
    }
    ;
    HylarComponent.prototype.postLog = function (message) {
        this.log.unshift([new Date().toUTCString(), message]);
    };
    ;
    HylarComponent.prototype.sparql = function () {
        var _this = this;
        this.postLog("SPARQL query '" + this.sparqlQuery.substr(0, 10) + "...' sent to the " + this.configuration.querying + ".");
        switch (this.configuration.querying) {
            case HConfig.client:
                this.client
                    .query(this.sparqlQuery)
                    .then(function (results) {
                    _this.postLog("Finished, " + results.length + " results found");
                    _this.results = results;
                }).catch(function (ex) {
                    _this.postLog(ex);
                });
                break;
            default:
                this.postLog("Expected either client or server configuration, none found.");
        }
    };
    HylarComponent = __decorate([
        core_1.Component({
            selector: 'hylar',
            templateUrl: '../hylar.html'
        }), 
        __metadata('design:paramtypes', [])
    ], HylarComponent);
    return HylarComponent;
}());
exports.HylarComponent = HylarComponent;
//# sourceMappingURL=hylar.component.js.map