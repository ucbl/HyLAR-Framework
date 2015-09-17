/**
 * Created by Spadon on 19/08/2015.
 */

var should = require('should');
var fs = require('fs');
var path = require('path');

var JswParser = require('../server/ontology/jsw/JswParser');
var JswOWL = require('../server/ontology/jsw/JswOWL');
var JswRDF = require('../server/ontology/jsw/JswRDF');
var Reasoner = require('../server/ontology/jsw/Reasoner');
var JswSPARQL = require('../server/ontology/jsw/JswSPARQL');

var Logics = require('../server/ontology/jsw/Logics');

var owl, ontology, reasoner, rule, fipa = '/../server/ontologies/fipa.owl';

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
        reasoner = Reasoner.create(ontology);
        reasoner.should.exist;
    });

    it('should convert axioms', function () {
        var formalAxioms = reasoner.resultOntology.convertAxioms();
        formalAxioms.length.should.be.above(0);
    });
});

describe('Rule creation', function () {
    it('should create a rule', function () {
        var axiom1 = new Logics.axiom(JswRDF.IRIs.SUBCLASS, 'a', 'b'),
            axiom2 = new Logics.axiom(JswRDF.IRIs.SUBCLASS, 'b', 'c'),
            axiom3 = new Logics.axiom(JswRDF.IRIs.SUBCLASS, 'a', 'c');
        rule = new Logics.rule([axiom1, axiom2], axiom3);
        rule.should.exist;
    });
});

describe('INSERT query with subsumption', function () {
    var query, results;
    it('should parse the INSERT statement', function () {
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
            'INSERT DATA { <#Inspiron> rdf:type <#Device> . ' +
            '<#Inspiron> <#hasConnection> <#Wifi> . ' +
            '<#Request1> rdf:type <#RequestDeviceInfo> . ' +
            '<#Inspiron> <#hasName> "Dell Inspiron 15R" . ' +
            '<#Wifi> rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
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
        results[0][0]['a'].should.equal('#Inspiron');
    });

    it('should find another class assertion', function () {
        // Multiple ClassAssertion Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('#Wifi');
    });

    it('should find an objectProperty assertion', function () {
        // ObjectProperty Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a <#hasConnection> <#Wifi> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('#Inspiron');
    });

    it('should find a dataProperty assertion', function () {
        // DataProperty Test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { <#Inspiron> <#hasName> ?a . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('"Dell Inspiron 15R"');
    });

    it('should find a subsumed class assertion', function () {
        // Subsumption test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'SELECT ?a { ?a rdf:type <#Function> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('#Request1');
    });

    it('should find a dataProperty with two variables', function () {
        // DataProperty with two variables test
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
            'SELECT ?a ?b { ?a <#hasName> ?b . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
        results[0][0]['a'].should.equal('#Inspiron');
        results[0][0]['b'].should.equal('"Dell Inspiron 15R"');
    });

});

describe('DELETE query with subsumption', function () {
    var query, results;
    it('should DELETE with subsumptions', function () {
        query = JswSPARQL.sparql.parse('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'DELETE DATA { <#Request1> rdf:type <#RequestDeviceInfo> . ' +
        '<#Inspiron> <#hasName> "Dell Inspiron 15R" . ' +
        '<#Wifi> rdf:type <#ConnectionDescription> . }');
        query.should.exist;
        results = reasoner.answerQuery(query);
    });

    it('should remain 2 ClassAssertions', function () {
        reasoner.aBox.database.ClassAssertion.length.should.equal(2);
    });
    it('should remain the exact same number of ObjectPropertyAssertions', function () {
        reasoner.aBox.database.ObjectPropertyAssertion.length.should.equal(2);
    });
    it('should not remain any DataPropertyAssertion', function () {
        reasoner.aBox.database.DataPropertyAssertion.length.should.equal(0);
    });

});