/**
 * Created by Spadon on 19/08/2015.
 */

var should = require('should');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var JswParser = require('../server/ontology/jsw/JswParser');
var JswOWL = require('../server/ontology/jsw/JswOWL');
var JswRDF = require('../server/ontology/jsw/JswRDF');
var Reasoner = require('../server/ontology/jsw/Reasoner');
var JswSPARQL = require('../server/ontology/jsw/JswSPARQL');

var Logics = require('../server/ontology/jsw/Logics');
var Utils = require('../server/ontology/jsw/Utils');
var ReasoningEngine = require('../server/ontology/jsw/ReasoningEngine');

var owl, ontology, reasoner, rule, fipa = '/../server/ontologies/fipa.owl', asawoo = '/../server/ontologies/fipa.owl';

var before, after, bIns, ts, tf;

describe('File access', function () {
    it('should access the file', function () {
        var exists = fs.existsSync(path.resolve(__dirname + asawoo));
        exists.should.equal(true);
    });
});

describe('File reading', function () {
    it('should correctly read the file', function () {
        var data = fs.readFileSync(path.resolve(__dirname + asawoo));
        data.should.exist;
        owl = data.toString().replace(/(&)([a-z0-9]+)(;)/gi, '$2:');
    });
});

describe('Ontology Parsing', function () {
    it('should parse the ontology', function () {
        ts = new Date().getTime();
        ontology = JswParser.parse(owl, function (err) {
            console.err(err);
        });
        ontology.should.exist;
        console.log((new Date().getTime() - ts) + ' ms');
    });
});

describe('Ontology Classification', function () {
    it('should classify the ontology', function () {
        ts = new Date().getTime();
        reasoner = Reasoner.create(ontology);
        reasoner.should.exist;
        before = reasoner.aBox.convertAssertions().length;
        console.log((new Date().getTime() - ts) + ' ms');
    });

    it('should convert axioms', function () {
        var formalAxioms = reasoner.resultOntology.convertAxioms();
        formalAxioms.length.should.be.above(0);
    });
});

describe('INSERT query with subsumption', function () {
    var query, results;
    it('should parse the INSERT statement and infer data', function () {
        ts = new Date().getTime();
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'INSERT DATA { <#Inspiron> rdf:type <#Device> . ' +
        '<#Inspiron> <#hasConnection> <#Wifi> . ' +
        '<#Request1> rdf:type <#RequestDeviceInfo> . ' +
        '<#Inspiron> <#hasName> "Dell Inspiron 15R" . ' +
        '<#Wifi> rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        console.log((new Date().getTime() - ts) + ' ms');
    });
});

describe('SELECT query with subsumption', function () {
    var query, results;
    it('should find a class assertion', function () {
        // ClassAssertion Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a rdf:type <#Device> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        _.findIndex(results[0], {'a': '#Inspiron'}).should.be.above(-1);
    });

    it('should find another class assertion', function () {
        // Multiple ClassAssertion Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        _.findIndex(results[0], {'a': '#Wifi'}).should.be.above(-1);
    });

    it('should find an objectProperty assertion', function () {
        // ObjectProperty Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a <#hasConnection> <#Wifi> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        _.findIndex(results[0], {'a': '#Inspiron'}).should.be.above(-1);
    });

    it('should find a dataProperty assertion', function () {
        // DataProperty Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { <#Inspiron> <#hasName> ?a . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        _.findIndex(results[0], {'a': '"Dell Inspiron 15R"'}).should.be.above(-1);
    });

    it('should find a subsumed class assertion', function () {
        // Subsumption test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a rdf:type <#Function> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        _.findIndex(results[0], {'a': '#Request1'}).should.be.above(-1);

    });

    it('should find a dataProperty with two variables', function () {
        // DataProperty with two variables test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a ?b { ?a <#hasName> ?b . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        _.findIndex(results[0], {'a': '#Inspiron'}).should.be.above(-1);
        _.findIndex(results[0], {'b': '"Dell Inspiron 15R"'}).should.be.above(-1);
    });

});

describe('Re-INSERT exact same query', function () {
    var query;
    it('should not change anything (insert)', function () {
        ts = new Date().getTime();
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'INSERT DATA { <#Inspiron> rdf:type <#Device> . ' +
        '<#Inspiron> <#hasConnection> <#Wifi> . ' +
        '<#Request1> rdf:type <#RequestDeviceInfo> . ' +
        '<#Inspiron> <#hasName> "Dell Inspiron 15R" . ' +
        '<#Wifi> rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        bIns = reasoner.aBox.convertAssertions().length;
        reasoner.answerQuery(query);
        console.log((new Date().getTime() - ts) + ' ms');
        reasoner.aBox.convertAssertions().length.should.eql(bIns);
    });
});

describe('DELETE query with subsumption', function () {
    var query, results;
    it('should DELETE with subsumptions', function () {
        ts = new Date().getTime();
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'DELETE DATA { <#Inspiron> rdf:type <#Device> . ' +
        '<#Inspiron> <#hasConnection> <#Wifi> . ' +
        '<#Request1> rdf:type <#RequestDeviceInfo> . ' +
        '<#Inspiron> <#hasName> "Dell Inspiron 15R" . ' +
        '<#Wifi> rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        console.log((new Date().getTime() - ts) + ' ms');
        after = reasoner.aBox.convertAssertions().length;
        after.should.eql(before);
    });
});