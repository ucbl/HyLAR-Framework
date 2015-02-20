/**
 * Created by Spadon on 20/02/2015.
 */

app.service('HylarRemote', ['OntologyClassifier', 'OntologyFetcher', 'RemoteOntologies', 'QueryProcessor',
    function(OntologyClassifier, OntologyFetcher, RemoteOntologies, QueryProcessor) {
        this.classify = OntologyClassifier.classify;
        this.fetch = OntologyFetcher.fetch;
        this.query = QueryProcessor.query;

        this.list = RemoteOntologies.getList();
    }
]);