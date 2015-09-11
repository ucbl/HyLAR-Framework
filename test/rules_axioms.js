/**
 * Created by MT on 11/09/2015.
 */

var should = require('should');
var fs = require('fs');

var Logic = require('../server/ontology/jsw/Logic');

describe('Rule creation', function () {
    it('should create a rule', function () {
        var axiom1 = new Logic.axiom('subClassOf', 'a', 'b'),
            axiom2 = new Logic.axiom('subClassOf', 'b', 'c'),
            axiom3 = new Logic.axiom('subClassOf', 'a', 'c');
        var rule = new Logic.rule([axiom1, axiom2], axiom3);
        rule.should.exist;
    });
});