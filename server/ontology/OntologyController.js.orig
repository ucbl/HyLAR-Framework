/**
 * Created by Spadon on 02/10/2014.
 */

var fs = require('fs'),
    _ = require('lodash'),
    Stopwatch = require('node-stopwatch').Stopwatch,

    JswParser = require('./jsw/JswParser'),
    JswOWL = require('./jsw/JswOWL'),
    JswRDF = require('./jsw/JswRDF'),
    JswOntology = require('./jsw/JswOntology'),
    JswBrandT = require('./jsw/JswBrandT'),
    Exporter = require('./jsw/Exporter');

module.exports = {

    /**
     * Simple HelloWorld
     * @param req
     * @param res
     */
    hello: function(req, res) {
        res.send('hello world');
    },

    /**
     * CORS Middleware
     * @param req
     * @param res
     */
    allowCrossDomain: function(req, res, next) {
        res.header('Access-Control-Allow-Origin', 'http://localhost:9000');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    },

    /**
     * OWL File content to text
     * @param req
     * @param res
     * @param next
     */
    getOntology: function(req, res, next) {
        var initialTime = req.param('time'),
            receivedReqTime = new Date().getTime();

        req.requestDelay =  receivedReqTime - initialTime;
        var filename = req.param('filename');

        fs.readFile('./ontologies/' + filename, function(err, data) {
            if(err) {
                res.status(500).send(err.toString());
            } else {
                req.owl = data.toString().replace(/(&)([a-z0-9]+)(;)/gi, '$2:');
                next();
            };
        });
    },

    /**
     * String parser
     * @param req
     * @param res
     */
    parseString: function(req, res, next) {
        var rdfXml = req.owl,
            ontology = JswParser.parse(rdfXml,
                function(err) {
                    res.status(500).send(err);
                });

        req.ontology = ontology;
        next();
    },

    generateReasoner: function(req, res) {
        var data = {
            ontology: req.ontology,
            resultOntology: new JswOntology.ontology(),
            owl: JswOWL,
            rdf: JswRDF
        },
            initialTime = new Date().getTime();

        var reasoner = new JswBrandT.reasoner(data);
        req.processingDelay  = new Date().getTime() - initialTime;

        res.send({
            ontology: data.resultOntology,
            reasoner: reasoner,
            owl: data.owl,
            rdf: data.rdf,
            requestDelay: req.requestDelay,
            processingDelay: req.processingDelay,
            time: new Date().getTime()
        });
    },

    /**
     * Returns config from JSW OWL
     * @param req
     * @param res
     */
    getJswOWL: function(req, res) {
      res.send(JswOWL);
    },

    /**
     * Returns config from JSW RDF
     * @param req
     * @param res
     */
    getJswRDF: function(req, res) {
        res.send(JswRDF);
    },

    /**
     * Returns an empty jsw ontology object
     * @param req
     * @param res
     */
    generateOntology: function(req, res) {
        res.send({ data: new JswOntology.ontology() });
    },

    /**
     * End-method returning an ontology
     * @param req
     * @param res
     */
    sendOntology: function(req, res) {
        res.send({ 'data': req.owl });
    },

    /**
     * Exports need JS files containing
     * prototypes for use on client
     */
    saveExportsToClient: function() {
        Exporter.getJsExports().then(function(content) {
            fs.writeFile("./app/workers/owlreasoner_common.js", content, function(err) {
                if(err) {
                    console.log(err);
                }
            });
            return;
        });
    }
};