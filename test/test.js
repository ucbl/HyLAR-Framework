/**
 * Created by Spadon on 19/08/2015.
 */

var should = require('should');
var fs = require('fs');
var path = require('path');

var JswParser = require('../server/ontology/jsw/JswParser');
var JswBrandT = require('../server/ontology/jsw/JswBrandT');
var JswSPARQL = require('../server/ontology/jsw/JswSPARQL');

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

describe('Ontology Parsing', function () {
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

    it('should find some Classes, ObjectProperties and DataProperties', function () {
        reasoner.tBox.database.Class.length.should.be.above(0);
        reasoner.tBox.database.ObjectProperty.length.should.be.above(0);
        reasoner.tBox.database.DataProperty.length.should.be.above(0);
    });
});

describe('INSERT query', function () {
    var query;
    it('should parse the INSERT statement', function () {
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
            'INSERT DATA { <#Inspiron> rdf:type <#Device> . ' +
            '<#Inspiron> <#hasConnection> <#Wifi> . ' +
            //'<#Inspiron> <#hasName> "Dell Inspiron 15R" . ' +
            '<#Wifi> rdf:type <#ConnectionDescription> . }');
        query.should.exist;
    });

    it('should insert 3 triples in the database', function () {
        var results = reasoner.answerQuery(query, ontology);
        reasoner.aBox.database.ClassAssertion.length.should.equal(4);
        reasoner.aBox.database.ObjectPropertyAssertion.length.should.equal(1);
        //todo test dataProperty
    });
});

describe('SELECT query', function () {
    var query, results;
    it('should parse and execute the SELECT statements', function () {
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
            'SELECT ?a { ?a rdf:type <#Device> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('#Inspiron');

        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
            'SELECT ?a { ?a rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('#Wifi');
    });
});