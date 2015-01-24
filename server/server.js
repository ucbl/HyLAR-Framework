/**
 * Created by Spadon on 02/10/2014.
 */
var express = require('express'),
    app = express();

var OntologyController = require('./ontology/OntologyController');

// Cross domain allowed
app.all('*', OntologyController.allowCrossDomain);

// Hello world
app.get('/', OntologyController.hello);

// OWL ontology parsing, getting, classifying
app.get('/ontologies/:filename', OntologyController.getOntology, OntologyController.sendOntology);
app.post('/classify', OntologyController.getOntology, OntologyController.parseString, OntologyController.generateReasoner);

// Jsw config
app.get('/jsw/owl', OntologyController.getJswOWL);
app.get('/jsw/rdf', OntologyController.getJswRDF);
app.get('/jsw/ontology', OntologyController.generateOntology);

// Preparing imports for angular
OntologyController.saveExportsToClient();

// Launching server
app.listen(3000);

