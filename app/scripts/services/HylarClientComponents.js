/**
 * Created by Spadon on 20/02/2015.
 */

app.factory('OntologyParser',
    function() {
        return {
            parse: function(data) {
                return JswParser.parse(data, function(e) {
                    console.log('error when parsing');
                });
            }
        }
    })

    .factory('ReasoningService', ['$q', 'OntologyParser',
        function($q, OntologyParser) {
            var ReasonerWorker = new Worker('workers/ReasonerWorker.js'),
                defer = $q.defer();

            ReasonerWorker.addEventListener('message', function(message) {
                if(message.data.create) {
                    localStorage.setItem('create', message.data.create);
                }
                defer.resolve(message.data);

            }, false);

            return {
                process: function(data) {
                    defer = $q.defer();

                    // if the ontology is not yet parsed
                    // (done outside the worker in order to use DOMParser)
                    if(!data.create) {
                        data.ontology = OntologyParser.parse(data.ontology);
                    } else {
                        data.create = JSON.parse(data.create);
                    }

                    if(data.inWorker) {
                        ReasonerWorker.postMessage(JSON.stringify(data));
                    } else {
                        // Special case when processing outside of the worker
                        var received = receive({
                            data: JSON.stringify(data)
                        });

                        if(received.create) {
                            localStorage.setItem('create',received.create);
                        }
                        defer.resolve(received);
                    }

                    return defer.promise;
                }
            };
        }]);
