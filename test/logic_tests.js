/**
 * Created by pc on 16/09/2015.
 */


var should = require('should');
var Logics = require('../server/ontology/jsw/Logics');

var parameters = {
    ontologySizeThreshold: 50,
    pingThreshold: 150,
    batteryLevelThreshold: 0.2
};

var rules = {
    queryingLocation: [
        new Rule(
            [new Fact('exceedsMs', 'Ping', parameters.pingThreshold.toString())],
            new Fact('execLocation', 'QueryAnswering', 'Client')),

        new Rule(
            [new Fact('exceedsPercent', 'BatteryLevel', parameters.batteryLevelThreshold.toString())],
            new Fact('execLocation', 'QueryAnswering', 'Client')),

        new Rule(
            [
                new Fact('lowerOrEqualsMs', 'Ping', parameters.pingThreshold.toString()),
                new Fact('lowerOrEqualsPercent', 'BatteryLevel', parameters.batteryLevelThreshold.toString())
            ],
            new Fact('execLocation', 'QueryAnswering', 'Server'))
    ],

    classifLocation: [
        new Rule(
            [new Fact('exceedsSize', '?OntologySize', parameters.ontologySizeThreshold.toString())],
            new Fact('execLocation', 'Classification', 'Server')),

        new Rule(
            [new Fact('lowerOrEqualsPercent', 'BatteryLevel', parameters.batteryLevelThreshold.toString())],
            new Fact('execLocation', 'Classification', 'Server')),

        new Rule(
            [
                new Fact('lowerOrEqualsSize', 'OntologySize', parameters.ontologySizeThreshold.toString()),
                new Fact('exceedsPercent', 'BatteryLevel', parameters.batteryLevelThreshold.toString())
            ],
            new Fact('execLocation', 'Classification', 'Client'))
    ]
};



describe('Adaptation rules', function () {
    it('should return something', function () {
        var results,
            facts = [
            new Logics.fact('lowerOrEqualsSize', 'OntologySize', '50'),
            new Logics.fact('lowerOrEqualsMs', 'Ping', '150'),
            new Logics.fact('exceedsPercent', 'BatteryLevel', '0.2')
        ];

        results = Logics.core.evaluateRuleSet(rules.classifLocation, facts, []);
        results.length.should.be.above(1);
    });
});
