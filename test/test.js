/**
 * Created by Spadon on 19/08/2015.
 */

var should = require('should');
var fs = require('fs');
var path = require('path');

var JswParser = require('../server/ontology/jsw/JswParser');
var JswBrandT = require('../server/ontology/jsw/JswBrandT');

var owl, ontology, reasoner, fipa = '/../server/ontologies/fipa.owl';

describe('File access', function () {
    it('should access the file', function () {
        var exists = fs.existsSync(path.resolve(__dirname + fipa));
        exists.should.equal(true);
    });
});

describe('File reading', function () {
    it('should correctly read the file', function () {
        var data = fs.readFileSync(path.resolve(__dirname + fipa));
        data.should.exist;
        owl = data.toString().replace(/(&)([a-z0-9]+)(;)/gi, '$2:');
    });
});

describe('Ontology parsing', function () {
    it('should parse the ontology', function () {
        ontology = JswParser.parse(owl, function (err) {
            console.err(err);
        });
        ontology.should.exist;
    });
});

describe('Ontology Classification', function () {
    it('should classify the ontology', function () {
        reasoner = JswBrandT.reasoner(ontology);
        reasoner.should.exist;
    });

    it('should find some Classes and ObjectProperties', function() {
       reasoner.aBox.database.ClassAssertion.should.be.above(0);
       reasoner.aBox.database.ObjectPropertyAssertion.should.be.above(0);
    });
});