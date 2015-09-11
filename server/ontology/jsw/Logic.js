/**
 * Created by MT on 11/09/2015.
 */

/**
 * Rule in the form subClassOf(a, b) ^ subClassOf(b, c) -> subClassOf(a, c)
 * @param sla set of (left side) conjunctive axioms
 * @param sra set of (right side) conjunctive axioms
 * @constructor
 */
var Rule = function(sla, sra) {
    if(sla && sra) {
        this.leftAxioms = sla;
        this.rightAxioms = sra;
    } else {
        this.leftAxioms = [];
        this.rightAxioms = [];
    }
};

Rule.prototype = {};

/**
 * Axiom in the form subClassOf(a, b)
 * @param name axiom's name (e.g. subClassOf)
 * @param li left individual
 * @param ri right individual
 * @constructor
 */
var Axiom = function(name, li, ri) {
    if ( !(name && li && ri) ) throw "Empty axioms are not allowed.";
    this.name = name;
    this.leftIndividual = li;
    this.rightIndividual = ri;
};

Axiom.prototype = {};

module.exports = {
    rule: function(sla, sra) {
        return new Rule(sla, sra);
    },

    axiom: function(name, li, ri) {
        return new Axiom(name, li, ri);
    }
};