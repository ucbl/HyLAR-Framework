/**
 * Created by Spadon on 20/10/2014.
 */

app.factory('OntologyClassifier', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/classify', {}, {
                'classify': { method: 'GET', params: {filename: '@filename', time: '@time', reasoningMethod: '@reasoningMethod'}, isArray: false }
            });
        }
    ])

    .factory('OntologyFetcher', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/ontology/:filename', {}, {
                'fetch': { method: 'GET', params: {filename: '@filename', time: '@time', reasoningMethod: '@reasoningMethod'}, isArray: false }
            });
        }
    ])

    .factory('OntologyDeleter', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/ontology/:filename', {}, {
                'delete': { method: 'DELETE', params: {filename: '@filename'}, isArray: false }
            });
        }
    ])

    .factory('RemoteOntologies', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/ontology', {}, {
                'getList': { method: 'GET', params: {}, isArray: true }
            });
        }
    ])

    .factory('QueryProcessor', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/query', {}, {
                'query': { method: 'GET', params: {query: '@query', time: '@time'}, isArray: false }
            });
        }
    ]);