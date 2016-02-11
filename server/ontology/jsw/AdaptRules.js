/**
 * Created by pc on 11/02/2016.
 */

var Logics = require('./Logics');

module.exports = {
    classifLocation: [
        new Logics.rule(
            [new Logics.fact('OntologySize', 'exceeds', '150')],
            new Logics.fact('Classification', 'execLocation', 'Server')),

        new Logics.rule(
            [new Logics.fact('BatteryLevel', 'lowerOrEquals', '0.2')],
            new Logics.fact('Classification', 'execLocation', 'Server')),

        new Logics.rule(
            [
                new Logics.fact('OntologySize', 'lowerOrEquals', '150'),
                new Logics.fact('BatteryLevel', 'exceeds', '0.2')
            ],
            new Logics.fact('Classification', 'execLocation', 'Client'))
        ],

    queryingLocation: [
        new Logics.rule(
            [new Logics.fact('Ping', 'exceeds', '150')],
            new Logics.fact('QueryAnswering', 'execLocation', 'Client')),

        new Logics.rule(
            [new Logics.fact('BatteryLevel', 'exceeds', '0.2')],
            new Logics.fact('QueryAnswering', 'execLocation', 'Client')),

        new Logics.rule(
            [
                new Logics.fact('Ping', 'lowerOrEquals', '150'),
                new Logics.fact('BatteryLevel', 'lowerOrEquals', '0.2')
            ],
            new Logics.fact('QueryAnswering', 'execLocation', 'Server'))
    ]
}