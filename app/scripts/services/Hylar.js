/**
 * Created by Spadon on 01/12/2014.
 */

app.service('Hylar', ['OntologyParser', 'ReasoningService',
    function(OntologyParser, ReasoningService) {
        this.process = ReasoningService.process;
        this.parse = OntologyParser.parse;
    }
]);