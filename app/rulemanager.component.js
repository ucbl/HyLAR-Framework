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
var Rule = (function () {
    function Rule() {
        this.activated = true;
    }
    return Rule;
}());
var RuleManagerComponent = (function () {
    function RuleManagerComponent() {
        this.rules = [];
        this.newRule = new Rule();
        var formattedRules = new Hylar().rules;
        if (localStorage.getItem("rules")) {
            this.rules = JSON.parse(localStorage.getItem("rules"));
        }
        else {
            for (var _i = 0, formattedRules_1 = formattedRules; _i < formattedRules_1.length; _i++) {
                var rule = formattedRules_1[_i];
                this.rules.push({
                    rule: rule.toString(),
                    name: rule.name,
                    activated: true
                });
            }
        }
    }
    RuleManagerComponent.prototype.updateLocalStorage = function () {
        var that = this;
        setTimeout(function () {
            localStorage.setItem("rules", JSON.stringify(that.rules));
        }, 200);
    };
    RuleManagerComponent.prototype.addRule = function () {
        try {
            Logics.parseRule(this.newRule.rule);
        }
        catch (e) {
            alert("Rule cannot be parsed.");
            return;
        }
        this.rules.unshift(this.newRule);
        this.rules = this.rules.slice();
        this.updateLocalStorage();
        this.newRule = new Rule();
    };
    __decorate([
        core_1.Input(), 
        __metadata('design:type', Array)
    ], RuleManagerComponent.prototype, "rules", void 0);
    __decorate([
        core_1.Input(), 
        __metadata('design:type', Rule)
    ], RuleManagerComponent.prototype, "newRule", void 0);
    RuleManagerComponent = __decorate([
        core_1.Component({
            selector: 'rule-manager',
            templateUrl: '../rulemanager.html'
        }), 
        __metadata('design:paramtypes', [])
    ], RuleManagerComponent);
    return RuleManagerComponent;
}());
exports.RuleManagerComponent = RuleManagerComponent;
//# sourceMappingURL=rulemanager.component.js.map