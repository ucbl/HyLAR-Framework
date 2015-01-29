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
app.get('/ontology/:filename', OntologyController.getOntology, OntologyController.sendOntology);
app.get('/classify', OntologyController.getOntology, OntologyController.parseString, OntologyController.generateReasoner, OntologyController.sendClassificationData);

//SPARQL query processing
app.get('/query', OntologyController.processSPARQL);

// Launching server
app.listen(3000);

