/**
 * Created by MT on 11/09/2015.
 * Logics module
 */

var UNKNOWN = 'unknown';
var Combinatorics = require('js-combinatorics');

var subsetOf = function(arr1, arr2) {
    for (var key in arr2) {
        if (JSON.stringify(arr1).indexOf(JSON.stringify(arr2[key]) === -1)) return false;
    }
    return true;
};
var diff = function(arr1, arr2) {
    return arr1.filter(function(i) {return arr2.indexOf(i) < 0;});
};

var uniqConcat = function(arr1, arr2) {
    var bigger, lower;

    if(arr1.length > arr2.length) {
        bigger = arr1;
        lower = arr2;
    } else {
        bigger = arr2;
        lower = arr1;
    }

    for(var key in lower) {
        if(JSON.stringify(bigger).indexOf(JSON.stringify(lower[key])) === -1) {
            bigger.push(lower[key]);
        }
    }
    return bigger;
};

/**
 * Rule in the form subClassOf(a, b) ^ subClassOf(b, c) -> subClassOf(a, c)
 * i.e. conjunction of axioms
 * @param sla set of (left side) conjunctive axioms
 * @param ra the consequence axiom
 * @constructor
 */
Rule = function(sla, ra) {
    this.leftAxioms = sla;
    this.rightAxiom = ra;
};

Rule.prototype = {
    leftAxiomsToString: function() {
        var axiomConj = '';
        for(var key in this.leftAxioms) {
            axiomConj += ' ^ ' + this.leftAxioms[key].toString();
        }
        return axiomConj.substr(3);
    },

    toString: function() {
        var axiomConj = '';
        for(var key in this.leftAxioms) {
            axiomConj += ' ^ ' + this.leftAxioms[key].toString();
        }
        return axiomConj.substr(3) + ' -> ' + this.rightAxiom.toString();
    },

    /**
     * Verifies if a set of axioms satisfy the rule's condition
     * @param axioms: a set of axioms
     * @returns {boolean}
     */
    consequences: function(originalAxioms, allAxioms, previousConsequences) {

        if(!allAxioms) allAxioms = originalAxioms.slice(0);
        if(previousConsequences) uniqConcat(allAxioms, previousConsequences);

        var thisRule = this.patternize().rule,
            possibleConjunctions,
            consequences = [];

        // Calculation of all possible permuted combinations
        possibleConjunctions = Combinatorics.baseN(allAxioms, this.leftAxioms.length).toArray();

        // Checks if any conjunction shares the same pattern as current rule
        for (var key in possibleConjunctions) {
            var patternized = new Rule(possibleConjunctions[key], UNKNOWN).patternize(),
                shadowRule = patternized.rule,
                map = patternized.map;

            if(shadowRule.leftAxiomsToString() === thisRule.leftAxiomsToString()) {
                var reattr = thisRule.rightAxiom.reattribute(map);
                if (JSON.stringify(consequences).indexOf(JSON.stringify(reattr)) === -1) consequences.push(reattr);
            }
        }
        if(JSON.stringify(consequences) === JSON.stringify(previousConsequences)) {
            return diff(allAxioms, originalAxioms);
        }
        return this.consequences(originalAxioms, allAxioms, consequences);
    },

    /**
     * Generalizes a rule, e.g. the patternization of
     * hasChild(#Dad, #Kid) ^ hasBrother(#Dad, #Uncle) -> hasUncle(#Kid, #Uuncle)
     * would produce
     * hasChild(0, 1) ^ hasBrother(0, 2) -> hasUncle(1, 2)
     * @returns a JSON object containing:
     *          - map: the mapping between original variables (#Dad, #Kid, #Uncle)
     *                 and their patternized version (0, 1, 2)
     *          - rule: the patternized rule
     */
    patternize: function(map) {
        if(map === undefined) map = {};
        var leftAxioms = [],
            rightAxiom = [],
            patternized;

        for(var key in this.leftAxioms) {
            patternized = this.leftAxioms[key].patternize(map);
            leftAxioms[key] = patternized.axiom;
            map = patternized.map;
        }

        if(this.rightAxiom !== UNKNOWN) {
            patternized = this.rightAxiom.patternize(map);
            rightAxiom = patternized.axiom;
            map = patternized.map;
        }

        return {
            map: map,
            rule: new Rule(leftAxioms, rightAxiom)
        };
    },

    /**
     * Evaluates the rule wrt. an set of axioms
     * @param axiomSet
     */
    evaluate: function(axiomSet) {

    }
};

/**
 * Axiom in the form subClassOf(a, b)
 * @param name axiom's name (e.g. subClassOf)
 * @param li left individual
 * @param ri right individual
 * @constructor
 */
Axiom = function(name, li, ri) {
    this.name = name;
    this.leftIndividual = li;
    this.rightIndividual = ri;
};

Axiom.prototype = {

    toString: function() {
        return this.name + '(' + this.leftIndividual + ',' + this.rightIndividual + ')';
    },

    /**
     * Generalizes an axiom, e.g. the patternization of
     * hasChild(#Dad, #Kid) would produce hasChild(0, 1)
     * @param map: the original mapping of variables, if needed
     * @returns a JSON object containing:
     *          - map: the mapping between original variables
     *                 and their patternized version
     *          - axiom: the patternized axiom
     */
    patternize: function(map) {
        if(map === undefined) map = {};
        if (map[this.leftIndividual] === undefined) {
            map[this.leftIndividual] = Object.keys(map).length;
        }
        if(map[this.rightIndividual] === undefined) {
            map[this.rightIndividual] = Object.keys(map).length;
        }
        return {
            map: map,
            axiom: new Axiom(this.name, map[this.leftIndividual], map[this.rightIndividual])
        };
    },

    reattribute: function(map) {
        var leftIndividual,
            rightIndividual;
        for (var key in map) {
            if(map[key] === this.leftIndividual)  leftIndividual = key;
            if(map[key] === this.rightIndividual)  rightIndividual = key;
        }
        return new Axiom(this.name, leftIndividual, rightIndividual);
    }
};

module.exports = {
    rule: function(sla, sra) {
        return new Rule(sla, sra);
    },

    axiom: function(name, li, ri) {
        return new Axiom(name, li, ri);
    }
};