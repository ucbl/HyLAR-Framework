/**
 * Created by Spadon on 01/12/2014.
 */

app.service('HylarClient', ['OntologyParser', 'ReasoningService', 'DbManager',
    function(OntologyParser, ReasoningService, DbManager) {
        this.process = ReasoningService.process;
        this.parse = OntologyParser.parse;
        this.db = DbManager;
    }
]);