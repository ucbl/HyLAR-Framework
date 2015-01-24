/**
 * Created by Spadon on 20/10/2014.
 */


app.filter('displayMsg', function() {
        return function(logElt) {
            if(logElt.isError) return 'ERROR: ' + logElt.msg;
            return logElt.msg;
        }
    })

    .filter('displayDate', ['$filter', function($filter) {
        return function(logElt) {
            return '[' + $filter('date')(logElt.time, 'MM/dd/yyyy @ HH:mm:ss') +  ']'
        }
    }])

    .filter('displayStatus', function($filter) {
        return function(isLoading) {
            if(isLoading) return 'Busy';
            return 'Ready';
        }
    });