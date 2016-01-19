/**
 * Created by pc on 21/12/2015.
 */

app.service('ClientResources', ['ServerTime', function(ServerTime) {

    this.resources = function() {
        var blevel, bcharging;
        return navigator.getBattery()
            .then(function(battery) {
                blevel = battery.level;
                bcharging = true;
                return ServerTime.getServerTime().$promise
            })
            .then(function(res) {
                return {
                    ping: new Date().getTime() - res.milliseconds,
                    blevel: blevel,
                    bcharging: bcharging
                };
            });
    };

    this.performClassif = function() {
        return this.resources().then(function(res) {
            if(res.ping > 100) {
                return 'client';
            } else {
                return 'server';
            }
        });
    };

    this.performQuerying = function() {
        return this.resources().then(function(res) {
            if ((res.battery > 0.25) || (res.bcharging)) {
                return 'client';
            } else {
                return 'server';
            }
        });
    };
}]);
