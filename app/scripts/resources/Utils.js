/**
 * Created by Spadon on 20/02/2015.
 */

app.factory('ServerTime', ['$resource',
    function($resource) {
        var ENV = angular.injector(['config']).get('ENV');
        return $resource(ENV.serverRootPath + '/time', {}, {
            'getServerTime': { method: 'GET', params: {}, isArray: false }
        });
    }
]);



app.factory('Ping', ['$resource',
    function($resource) {
        var ENV = angular.injector(['config']).get('ENV');
        return $resource(ENV.serverRootPath + '/hello', {}, {
            'query': { method: 'GET', params: {time: '@time'}}
        });
    }
]);