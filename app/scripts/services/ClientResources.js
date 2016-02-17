/**
 * Created by pc on 21/12/2015.
 */

app.service('ClientResources', ['Hello', function(Hello) {

    this.resources = function() {
        var blevel, bcharging, timeA = new Date().getTime();
        return navigator.getBattery()
            .then(function(battery) {
                blevel = battery.level;
                bcharging = true;
                return Hello.getHello().$promise
            })
            .then(function(res) {
                return {
                    ping: new Date().getTime() - timeA,
                    blevel: blevel,
                    bcharging: bcharging
                };
            });
    };
}]);
