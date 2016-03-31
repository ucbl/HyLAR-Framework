/**
 * Created by Spadon on 20/02/2015.
 */

app.service('HylarRemote', ['OntologyClassifier', 'OntologyFetcher', 'OntologyDeleter', 'RemoteOntologies', 'QueryProcessor',
    function(OntologyClassifier, OntologyFetcher, OntologyDeleter, RemoteOntologies, QueryProcessor) {
        this.classify = OntologyClassifier.classify;
        this.fetch = OntologyFetcher.fetch;
        this.delete = OntologyDeleter.delete;
        this.query = QueryProcessor.query;
        this.list = RemoteOntologies.getList;
    }
]);