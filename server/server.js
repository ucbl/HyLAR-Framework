/**
 * Created by Spadon on 02/10/2014.
 */
var express = require('express'),
    app = express();

var bodyParser = require('body-parser'),
    busboy  = require('connect-busboy');

var OntologyController = require('./ontology/OntologyController');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

app.use(busboy({ immediate: true }));

// parse application/json
app.use(bodyParser.json())

// Cross domain allowed
app.all('*', OntologyController.allowCrossDomain);

// Hello world
app.get('/', OntologyController.hello);

// OWL ontology parsing, getting, classifying
app.get('/ontology/:filename', OntologyController.getOntology, OntologyController.sendOntology);
app.get('/classify', OntologyController.getOntology, OntologyController.parseString, OntologyController.generateReasoner, OntologyController.sendClassificationData);

//SPARQL query processing
app.get('/query', OntologyController.processSPARQL);

//File uploading
app.post('/ontology', OntologyController.upload)

// Launching server
app.listen(3000);

