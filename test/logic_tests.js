/**
 * Created by pc on 16/09/2015.
 */

var should = require('should');
var Logics = require('../server/ontology/jsw/Logics');
var rule1;

describe('Rule creation', function () {
    it('should create a rule', function () {
        var axiom1 = new Logics.axiom('subClassOf', 'a', 'b'),
            axiom2 = new Logics.axiom('subClassOf', 'b', 'c'),
            axiom3 = new Logics.axiom('subClassOf', 'a', 'c');
        rule1 = new Logics.rule([axiom1, axiom2], axiom3);
        rule1.should.exist;
    });

    it('should verify the satisfiability of a rule', function () {
        var axioms = [
            new Logics.axiom('subClassOf', '#2', '#3'),
            new Logics.axiom('subClassOf', '#1', '#2'),
            new Logics.axiom('subClassOf', '#4', '#6'),
            new Logics.axiom('subClassOf', '#5', '#1')
        ];
        var consequences = rule1.consequences(axioms);
        consequences.length.should.equal(3);
    });
});