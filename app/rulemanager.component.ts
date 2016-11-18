import { Component, Input } from '@angular/core';

declare var Hylar:any, Logics: any;

class Rule {
    rule:string;
    name:string;
    activated:boolean;

    constructor() {
        this.activated = true;
    }
}

@Component({
    selector: 'rule-manager',
    templateUrl: '../rulemanager.html'
})

export class RuleManagerComponent {
    @Input() rules: Rule[] = [];
    @Input() newRule:Rule = new Rule();

    constructor() {        
        let formattedRules = new Hylar().rules;
        if (localStorage.getItem("rules")) {
            this.rules = JSON.parse(localStorage.getItem("rules")); 
        } else {
            for (let rule of formattedRules) {
                this.rules.push({
                    rule:rule.toString(),
                    name:rule.name,
                    activated: true
                })
            }       
        } 
    }

    public updateLocalStorage() {
        let that = this;
        setTimeout(function() {
            localStorage.setItem("rules", JSON.stringify(that.rules));
        }, 200)
        
    }

    public addRule() {
        try {
            Logics.parseRule(this.newRule.rule);
        } catch(e) {
            alert("Rule cannot be parsed.");
            return;
        }
        this.rules.unshift(this.newRule);
        this.rules = this.rules.slice();
        this.updateLocalStorage();
        this.newRule = new Rule();
    }
}  