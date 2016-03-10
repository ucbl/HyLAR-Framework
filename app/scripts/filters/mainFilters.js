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

    .filter('displayReasonerStatus', function($filter) {
        return function(exists) {
            if(!exists) return 'Ontology not loaded on client.';
            return 'Ontology loaded on client.';
        }
    })

    .filter('displayHyLARStatus', function($filter) {
        return function(isLoading) {
            if(isLoading) return 'Busy';
            return 'HyLAR is ready';
        }
    });