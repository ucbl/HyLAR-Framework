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
var AdaptationService = (function () {
    function AdaptationService() {
    }
    AdaptationService.prototype.getClassificationLocation = function (thresholds, current) {
        var rules = [
            ("(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type OntologySize) ^ (?s > " + thresholds.ontologySize + ") -> (Classification location Server)"),
            ("(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s <= " + thresholds.batteryLevel + ") -> (Classification location Server)"),
            ("(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type OntologySize) ^ (?s <= " + thresholds.ontologySize + ") ^ (?s2 http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s2 > " + thresholds.batteryLevel + ") -> (Classification location Client)"),
            ("(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type Ping) ^ (?s > " + thresholds.ping + ") -> (Querying location Client)"),
            ("(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s > " + thresholds.batteryLevel + ") -> (Querying location Client)"),
            ("(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type Ping) ^ (?s <= " + thresholds.ping + ") ^ (?s2 http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s2 <= " + thresholds.batteryLevel + ") -> (Querying location Server)"),
        ];
    };
    AdaptationService = __decorate([
        core_1.Injectable()({
            selector: 'adaptation'
        }), 
        __metadata('design:paramtypes', [])
    ], AdaptationService);
    return AdaptationService;
}());
exports.AdaptationService = AdaptationService;
//# sourceMappingURL=adaptation.service.js.map