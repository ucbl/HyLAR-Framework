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
            [new Fact('exceeds', 'Ping', parameters.pingThreshold.toString())],
            new Fact('execLocation', 'QueryAnswering', 'Client')),

        new Rule(
            [new Fact('exceeds', 'BatteryLevel', parameters.batteryLevelThreshold.toString())],
            new Fact('execLocation', 'QueryAnswering', 'Client')),

        new Rule(
            [
                new Fact('lowerOrEquals', 'Ping', parameters.pingThreshold.toString()),
                new Fact('lowerOrEquals', 'BatteryLevel', parameters.batteryLevelThreshold.toString())
            ],
            new Fact('execLocation', 'QueryAnswering', 'Server'))
    ],

    classifLocation: [
        new Rule(
            [new Fact('exceeds', 'OntologySize', parameters.ontologySizeThreshold.toString())],
            new Fact('execLocation', 'Classification', 'Server')),

        new Rule(
            [new Fact('lowerOrEquals', 'BatteryLevel', parameters.batteryLevelThreshold.toString())],
            new Fact('execLocation', 'Classification', 'Server')),

        new Rule(
            [
                new Fact('lowerOrEquals', 'OntologySize', parameters.ontologySizeThreshold.toString()),
                new Fact('exceeds', 'BatteryLevel', parameters.batteryLevelThreshold.toString())
            ],
            new Fact('execLocation', 'Classification', 'Client'))
    ]
};



describe('Adaptation rules', function () {
    it('should return something', function () {
        var results,
            facts = [
            new Logics.fact('lowerOrEquals', 'OntologySize', '50'),
            new Logics.fact('lowerOrEquals', 'Ping', '150'),
            new Logics.fact('exceeds', 'BatteryLevel', '0.2')
        ];

        results = Logics.core.evaluateRuleSet(rules.queryingLocation, facts, []);
        results.length.should.be.above(1);
    });
});
