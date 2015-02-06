/**
 * Created by Spadon on 02/10/2014.
 */

var fs = require('fs'),
    _ = require('lodash'),
    path = require('path'),

    JswParser = require('./jsw/JswParser'),
    JswOWL = require('./jsw/JswOWL'),
    JswRDF = require('./jsw/JswRDF'),
    JswOntology = require('./jsw/JswOntology'),
    JswBrandT = require('./jsw/JswBrandT'),
    Exporter = require('./jsw/Exporter'),
    JswSPARQL = require('./jsw/JswSPARQL'),

    ClassificationData = null,
    stringifiedReasoner = null,
    appDir = path.dirname(require.main.filename),
    ontoDir = appDir + '/../ontologies/',
    dbDir = appDir + '/../db/';

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

        fs.readFile(ontoDir + filename, function(err, data) {
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

    generateReasoner: function(req, res, next) {
        var data = {
                ontology: req.ontology,
                resultOntology: new JswOntology.ontology(),
                owl: JswOWL,
                rdf: JswRDF
            },
            initialTime = new Date().getTime();

        var reasoner = new JswBrandT.reasoner(data);

        req.processingDelay  = new Date().getTime() - initialTime;
        req.classificationData = {
            ontology: data.resultOntology,
            reasoner: reasoner
        };

        next();
    },

    sendClassificationData: function(req, res) {
        var seen = [];
        ClassificationData = req.classificationData;
        stringifiedReasoner = JSON.stringify(ClassificationData.reasoner, function(key, val) {
            if (val != null && typeof val == "object") {
                if (seen.indexOf(val) >= 0)
                    return;
                seen.push(val)
            }
            return val
        });

        fs.writeFileSync(dbDir + req.param('filename') + '.json',
            '{' +
                'reasoner: ' + stringifiedReasoner + ',' +
                'ontology: ' + JSON.stringify(ClassificationData.ontology) +
            '}'
        );
        
        res.status(200).send({
            data : {
                reasoner: stringifiedReasoner,
                ontology: ClassificationData.ontology,
                requestDelay: req.requestDelay,
                processingDelay: req.processingDelay,
                time: new Date().getTime(),
                name: req.param('filename')
            }
        });
    },

    /**
     * End-method returning an ontology
     * @param req
     * @param res
     */
    sendOntology: function(req, res) {
        res.send({
            'data': {
                'ontology': req.owl,
                'requestDelay': req.requestDelay,
                'time': new Date().getTime(),
                'name': req.param('filename')
            }
        });
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
    },

    processSPARQL: function(req, res) {
        var initialTime = req.param('time'),
            receivedReqTime = new Date().getTime(),
            requestDelay =  receivedReqTime - initialTime,
            processedTime;

        if(!ClassificationData) {
            processedTime = new Date().getTime();
            res.status(500).send({
                data : 'Reasoner not initialized!',
                processingDelay: 0,
                requestDelay : requestDelay,
                time: processedTime
            });
        } else {
            var sparql = new JswSPARQL.sparql(),
                query = sparql.parse(req.param('query')),
                results = ClassificationData.reasoner.aBox.answerQuery(query);

            processedTime = new Date().getTime();
            res.status(200).send({
                data : results,
                processingDelay: processedTime - receivedReqTime,
                requestDelay : requestDelay,
                time : new Date().getTime()
            });
        }
    },

    upload: function(req, res) {
        req.pipe(req.busboy);
        req.busboy.on('file', function (fieldname, file, filename) {
            var filePath = ontoDir + filename,
                fstream = fs.createWriteStream(filePath);
            file.pipe(fstream);
            fstream.on('close', function () {
                res.send(filePath);
            });
        });
    },

    list: function(req, res) {
        res.send(fs.readdirSync(ontoDir));
    }
};