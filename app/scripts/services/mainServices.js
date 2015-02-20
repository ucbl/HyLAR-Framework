/**
 * Created by Spadon on 01/12/2014.
 */

app.factory('OntologyParser', function() {
    return {
        parse: function(data) {Avata
            return JswParser.parse(data, function(e) {
                console.log('error when parsing');
            });
        }
    }
});

app.factory('ReasoningService', ['$q', 'OntologyParser', function($q, OntologyParser) {
    var ReasonerWorker = new Worker('workers/ReasonerWorker.js'),
        defer = $q.defer();

    ReasonerWorker.addEventListener('message', function(message) {
        if(message.data.reasoner) {
            localStorage.setItem('reasoner', message.data.reasoner);
        }
        defer.resolve(message.data);

    }, false);

    return {
        process: function(data) {
            defer = $q.defer();

            // if the ontology is not yet parsed
            // done outside the worker in order to use DOMParser
            if(!data.reasoner) {
                data.ontology = OntologyParser.parse(data.ontology);
            } else {
                data.reasoner = JSON.parse(data.reasoner);
            }

            if(data.inWorker) {
                ReasonerWorker.postMessage(JSON.stringify(data));
            } else {
                // Special case when processing outside of the worker
                var received = receive({
                    data: JSON.stringify(data)
                });

                if(received.reasoner) {
                    localStorage.setItem('reasoner',received.reasoner);
                }
                defer.resolve(received);
            }

            return defer.promise;
        }
    };
}]);

app.service('Hylar', function() {

});

app.service('LoggingService', function() {

    var msgData;

    this.log = [];

    this.msg = function(content) {
        msgData = new Object();
        msgData.msg = content;
        msgData.isError = false;
        return this;
    };

    this.err = function(content) {
        msgData = new Object();
        msgData.msg = content;
        msgData.isError = true;
        return this;
    };

    this.submit = function() {
        msgData.time = new Date().getTime();
        this.log.push(msgData);
    }
});