/**
 * Created by pc on 11/02/2016.
 */

app.service('AdaptationService', ['ClientResources', 'OntologyParser', function(ClientResources, OntologyParser) {

    this.classificationLocation = function(ontology) {
        var ontologySize = OntologyParser.parse(ontology),
            batteryLevel = ClientResources.resources().blevel,
            ping = ClientResources.resources().ping,
            facts,
            location;
        location = Logics.core.evaluateRuleSet(AdaptRules.classifLocation, facts, []);
        return location.object;
    };

    this.queryLocation = function(ontology) {
        var ontologySize = OntologyParser.parse(ontology),
            batteryLevel = ClientResources.resources().blevel,
            ping = ClientResources.resources().ping,
            facts,
            location;
        location = Logics.core.evaluateRuleSet(AdaptRules.queryingLocation, facts, []);
        return location.object;
    };

}]);