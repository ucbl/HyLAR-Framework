/**
 * Created by pc on 11/02/2016.
 */

app.service('AdaptationService', ['HylarRemote', 'ClientResources', 'OntologyParser', function(HylarRemote, ClientResources, OntologyParser) {

    this.parameters = {
        ontologySizeThreshold: 50,
        pingThreshold: 150,
        batteryLevelThreshold: 0.2
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

        (batteryLevel > this.parameters.batteryLevelThreshold)
            ? valuePredicate = 'exceedsPercent' : valuePredicate = 'lowerOrEqualsPercent';
        facts.push(new Fact(valuePredicate, 'BatteryLevel', this.parameters.batteryLevelThreshold.toString()));

        (ping > this.parameters.pingThreshold)
            ? valuePredicate = 'exceedsMs' : valuePredicate = 'lowerOrEqualsMs';
        facts.push(new Fact(valuePredicate, 'Ping', this.parameters.pingThreshold.toString()));

        return facts;
    };

    this.rules = {
        queryingLocation: [
            new Rule(
                [new Fact('exceedsMs', 'Ping', this.parameters.pingThreshold.toString())],
                new Fact('execLocation', 'QueryAnswering', 'client')),

            new Rule(
                [new Fact('exceedsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())],
                new Fact('execLocation', 'QueryAnswering', 'client')),

            new Rule(
                [
                    new Fact('lowerOrEqualsMs', 'Ping', this.parameters.pingThreshold.toString()),
                    new Fact('lowerOrEqualsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())
                ],
                new Fact('execLocation', 'QueryAnswering', 'server'))
        ],

        classifLocation: [
            new Rule(
                [new Fact('exceedsSize', '?OntologySize', this.parameters.ontologySizeThreshold.toString())],
                new Fact('execLocation', 'Classification', 'server')),

            new Rule(
                [new Fact('lowerOrEqualsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())],
                new Fact('execLocation', 'Classification', 'server')),

            new Rule(
                [
                    new Fact('lowerOrEqualsSize', 'OntologySize', this.parameters.ontologySizeThreshold.toString()),
                    new Fact('exceedsPercent', 'BatteryLevel', this.parameters.batteryLevelThreshold.toString())
                ],
                new Fact('execLocation', 'Classification', 'client'))
        ]
    };

    this.answerAdaptationQuestion = function(filename, question) {
        var ontologySize, batteryLevel, ping, facts, location, that = this;

            // Getting the ontology file
            return HylarRemote.fetch({ filename: filename }).$promise

            // Getting ontology size and client resources
            .then(function(file) {
                ontologySize = that.getOntologySize(OntologyParser.parse(file.data.ontology));
                return ClientResources.resources();
            })

            // Getting the answer of the adaptation question
            .then(function(clientResources) {
                batteryLevel = clientResources.blevel;
                ping = clientResources.ping;
                facts = that.generateFacts(ontologySize, batteryLevel, ping);
                location = Logics.evaluateRuleSet(question, facts, []);

                // Throwing an exception if there are many possible choices (currently unsupported)
                // Otherwise, returns the answer to the adaptation question.
                if(location.length > 1) {
                    throw new EvalError();
                    return false;
                } else {
                    return location[0].rightIndividual;
                }
            });
    };

    this.answerClassificationLocationQuestion = function(filename) {
        return this.answerAdaptationQuestion(filename, this.rules.classifLocation);
    };

    this.answerQueryAnsweringLocationQuestion = function(filename) {
        return this.answerAdaptationQuestion(filename, this.rules.queryingLocation);
    };

}]);