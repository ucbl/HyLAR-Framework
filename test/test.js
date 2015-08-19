/**
 * Created by Spadon on 19/08/2015.
 */

var should = require('should');
var fs = require('fs');

var JswParser = require('../server/ontology/jsw/JswParser');
var JswBrandT = require('../server/ontology/jsw/JswBrandT');

describe('Parsing and Classification on complex ontology (fipa)', function () {
    it('should have at least 1 ClassAssertion and 1 ObjectPropertyAssertion', function () {
        var owl, ontology, reasoner, fipa = '../server/ontologies/fipa.owl';

        describe('File access', function () {
            it('should access the file', function () {
                fs.exists(fipa, function (fileok) {
                    fileok.should.equal(true);
                });
            });
        });

        describe('File reading', function () {
            it('should correctly read the file', function () {
                fs.readFile(fipa, function (err, data) {
                    if (err) {
                        console.err(err.toString());
                    } else {
                        owl = data.toString().replace(/(&)([a-z0-9]+)(;)/gi, '$2:');
                    }
                });
                should.exist(owl);
            });
        });

        describe('Ontology parsing', function () {
            it('should parse the ontology', function () {
                ontology = JswParser.parse(owl, function (err) {
                    console.err(err);
                });
                should.exist(ontology);
            });
        });

        describe('Ontology Classification', function () {
            it('should classify the ontology', function () {
                reasoner = JswBrandT.reasoner(ontology);
                reasoner.should.exist;
            });
        });

        reasoner.ontology.should.exist;
    });
});
