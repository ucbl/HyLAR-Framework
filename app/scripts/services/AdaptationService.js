/**
 * Created by pc on 11/02/2016.
 */

app.service('AdaptationService', ['HylarRemote', 'ClientResources', 'OntologyParser', function(HylarRemote, ClientResources, OntologyParser) {

    this.parameters = {
        ontologySizeThreshold: 50,
        pingThreshold: 150,
        batteryLevelThreshold: 0.2
    },

    this.getOntologySize = function(parsedOntology) {
        var entityCount = parsedOntology.entityCount;
        return entityCount['9'] + entityCount['10'] +
            entityCount['11'] + entityCount['22'] + entityCount['25'];
    },

    this.generateFacts = function(ontologySize, batteryLevel, ping) {
        var valuePredicate, facts = [];

        (ontologySize > this.parameters.ontologySizeThreshold)
            ? valuePredicate = 'exceeds' : valuePredicate = 'lowerOrEquals';
        facts.push(new Fact(valuePredicate, 'OntologySize', this.parameters.ontologySizeThreshold.toString()));

        (batteryLevel > this.parameters.batteryLevelThreshold)
            ? valuePredicate = 'exceeds' : valuePredicate = 'lowerOrEquals';
        facts.push(new Fact(valuePredicate, 'BatteryLevel', this.parameters.batteryLevelThreshold.toString()));

        (ping > this.parameters.pingThreshold)
            ? valuePredicate = 'exceeds' : valuePredicate = 'lowerOrEquals';
        facts.push(new Fact(valuePredicate, 'Ping', this.parameters.pingThreshold.toString()));

        return facts;
    };

    this.rules = {
        queryingLocation: [
            new Rule(
                [new Fact('Ping', 'exceeds', this.parameters.pingThreshold.toString())],
                new Fact('QueryAnswering', 'execLocation', 'Client')),

            new Rule(
                [new Fact('BatteryLevel', 'exceeds', this.parameters.batteryLevelThreshold.toString())],
                new Fact('QueryAnswering', 'execLocation', 'Client')),

            new Rule(
                [
                    new Fact('Ping', 'lowerOrEquals', this.parameters.pingThreshold.toString()),
                    new Fact('BatteryLevel', 'lowerOrEquals', this.parameters.batteryLevelThreshold.toString())
                ],
                new Fact('QueryAnswering', 'execLocation', 'Server'))
        ],

        classifLocation: [
            new Rule(
                [new Fact('OntologySize', 'exceeds', this.parameters.ontologySizeThreshold.toString())],
                new Fact('Classification', 'execLocation', 'Server')),

            new Rule(
                [new Fact('BatteryLevel', 'lowerOrEquals', this.parameters.batteryLevelThreshold.toString())],
                new Fact('Classification', 'execLocation', 'Server')),

            new Rule(
                [
                    new Fact('OntologySize', 'lowerOrEquals', this.parameters.ontologySizeThreshold.toString()),
                    new Fact('BatteryLevel', 'exceeds', this.parameters.batteryLevelThreshold.toString())
                ],
                new Fact('Classification', 'execLocation', 'Client'))
        ]
    },

    this.classificationLocation = function(filename) {
        var ontologySize, batteryLevel, ping, facts, location, that = this,
            promise = HylarRemote.fetch({ filename: filename }).$promise;

        promise
            // Getting ontology size and client resources
            .then(function(file) {
                ontologySize = that.getOntologySize(OntologyParser.parse(file.data.ontology));
                return ClientResources.resources();
            })
            // Getting the execution location
            .then(function(clientResources) {
                batteryLevel = clientResources.blevel;
                ping = clientResources.ping;
                facts = that.generateFacts(ontologySize, batteryLevel, ping);
                location = Logics.evaluateRuleSet(that.rules.classifLocation, facts, []);
                return location.object;
            });

        return promise;
    };

    this.queryLocation = function(filename) {
    };

}]);