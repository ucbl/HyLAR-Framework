/**
 * Created by pc on 21/12/2015.
 */

app.service('ClientResources', ['Ping', function() {
    this.battery = navigator.getBattery();
    this.ping = 0;

    this.generatePing = function($resource) {
        var ENV = angular.injector(['config']).get('ENV');
        return $resource(ENV.serverRootPath + '/hello', {}, {
            'classify': { method: 'GET', params: {time: '@time', reasoningMethod: '@reasoningMethod'}, isArray: false }
        });
    }

}]);