/**
 * Created by pc on 11/02/2016.
 */

app.service('AdaptationService', ['$q', 'HylarRemote', 'ClientResources', 'OntologyParser', function($q, HylarRemote, ClientResources, OntologyParser) {

    this.rules = {};
    this.ruleDesc = {};

    this.parameters = {
        ontologySizeThreshold: 200,
        pingThreshold: 150,
        batteryLevelThreshold: 20
    };

    this.getOntologySize = function(parsedOntology) {
        var entityCount = parsedOntology.entityCount;
        return entityCount['9'] + entityCount['10'] +
            entityCount['11'] + entityCount['22'] + entityCount['25'] + parsedOntology.axioms.length;
    };

    this.generateFacts = function(ontologySize, batteryLevel, ping) {
        var valuePredicate, facts = [];

        (ontologySize > this.parameters.ontologySizeThreshold)
            ? valuePredicate = 'exceedsSize' : valuePredicate = 'lowerOrEqualsSize';
        facts.push(new Fact(valuePredicate, 'OntologySize', this.parameters.ontologySizeThreshold.toString()));

        (batteryLevel*100 > this.parameters.batteryLevelThreshold)
            ? valuePredicate = 'exceedsPercent' : valuePredicate = 'lowerOrEqualsPercent';
        facts.push(new Fact(valuePredicate, 'BatteryLevel', this.parameters.batteryLevelThreshold.toString()));

        (ping > this.parameters.pingThreshold)
            ? valuePredicate = 'exceedsMs' : valuePredicate = 'lowerOrEqualsMs';
        facts.push(new Fact(valuePredicate, 'Ping', this.parameters.pingThreshold.toString()));

        return facts;
    };

    this.regenerateRules = function() {
        this.rules = {
            queryingLocation: [
                new Rule(
                    [new Fact('exceedsMs', 'Ping', this.parameters.pingThreshold.toString())],
                    [new Fact('execLocation', 'QueryAnswering', 'client')]),

                new Rule(
                    [new Fact('exceedsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())],
                    [new Fact('execLocation', 'QueryAnswering', 'client')]),

                new Rule(
                    [
                        new Fact('lowerOrEqualsMs', 'Ping', this.parameters.pingThreshold.toString()),
                        new Fact('lowerOrEqualsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())
                    ],
                    [new Fact('execLocation', 'QueryAnswering', 'server')])
            ],

            classifLocation: [
                new Rule(
                    [new Fact('exceedsSize', 'OntologySize', this.parameters.ontologySizeThreshold.toString())],
                    [new Fact('execLocation', 'Classification', 'server')]),

                new Rule(
                    [new Fact('lowerOrEqualsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())],
                    [new Fact('execLocation', 'Classification', 'server')]),

                new Rule(
                    [
                        new Fact('lowerOrEqualsSize', 'OntologySize', this.parameters.ontologySizeThreshold.toString()),
                        new Fact('exceedsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())
                    ],
                    [new Fact('execLocation', 'Classification', 'client')])
            ]
        };

        this.ruleDesc = {
            queryingLocation:
            "If the ping duration is lower than (or equals) " + this.parameters.pingThreshold.toString() +
            "ms and the battery level is also lower than (or equals) " + this.parameters.batteryLevelThreshold.toString() +
            "%, the query answering location will be on the server side. Otherwise, it will be on the client side. ",

            classifLocation:
            "If the ontology size is lower than (or equals) " + this.parameters.ontologySizeThreshold.toString() +
            " entities and the battery level exceeds " + this.parameters.batteryLevelThreshold.toString() +
            "%, the classification location will be on the client side. Otherwise, it will be on the server side."
        };

    };

    this.answerAdaptationQuestion = function(filename, question) {
        var facts, location, that = this,
            status = {};

            // Getting the ontology file
            return HylarRemote.fetch({ filename: filename }).$promise

            // Getting ontology size and client resources
            .then(function(file) {
                try {
                    status.ontologySize = that.getOntologySize(OntologyParser.parse(file.data.ontology));
                } catch(err) {
                    status.ontologySize = 0;
                }
                return ClientResources.resources();
            })

            // Getting the answer of the adaptation question
            .then(function(clientResources) {
                status.batteryLevel = clientResources.blevel;
                status.ping = clientResources.ping;

                facts = that.generateFacts(status.ontologySize, status.batteryLevel, status.ping);
                location = Solver.evaluateRuleSet(question, facts, []);

                // Throwing an exception if there are many possible choices (currently unsupported)
                // Otherwise, returns the answer to the adaptation question.
                if(location.length > 1) {
                    throw new EvalError();
                    return false;
                } else {
                    return {
                        location: location[0].object,
                        status: status
                    };
                }
            });
    };

    this.answerClassificationLocationQuestion = function(filename, method) {
        if(method == 'auto') {
            return this.answerAdaptationQuestion(filename, this.rules.classifLocation);
        }
        return $q.when();
    };

    this.answerQueryAnsweringLocationQuestion = function(filename, method) {
        if(method == 'auto') {
            return this.answerAdaptationQuestion(filename, this.rules.queryingLocation);
        }
        return $q.when();
    };

}]);