/**
 * Created by Spadon on 20/10/2014.
 */

app.factory('Ontology', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/ontologies/:filename', {}, {
                'getOntologyText': { method: 'GET', params: {filename: '@filename'}, isArray: false }
            });
        }
    ])

    .factory('OntologyParser', ['$resource',
        function($resource) {
            var ENV = angular.injector(['config']).get('ENV');
            return $resource(ENV.serverRootPath + '/classify', {}, {
                'classify': { method: 'POST', params: {filename: '@filename', time: '@time'}, isArray: false }
            });
        }
    ]);
