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

    .factory('DbManager',
        function() {
            return {
                list: function() {
                    return JSON.parse(localStorage.getItem('db'));
                },

                get: function(field) {
                    return JSON.parse(localStorage.getItem('db'))[field];
                },

                update: function(field, data) {
                    var db = JSON.parse(localStorage.getItem('db')) || {};
                    db[field] = data;
                    localStorage.setItem('db', JSON.stringify(db));
                },

                delete: function(field) {
                    localStorage.removeItem(field);
                },

                purge: function(field) {
                    localStorage.removeItem('db');
                }
            }
        }
    )

    .factory('ReasoningService', ['$q', 'OntologyParser', 'DbManager',
        function($q, OntologyParser, DbManager) {
            var ReasonerWorker = new Worker('workers/ReasonerWorker.js'),
                defer = $q.defer();

            ReasonerWorker.addEventListener('message', function(message) {
                if(message.data.reasoner) {
                    DbManager.update(message.data.name, message.data.reasoner);
                }
                defer.resolve(message.data);

            }, false);

            return {
                process: function(data) {
                    defer = $q.defer();

                    // if the ontology is not yet parsed
                    // (done outside the worker in order to use DOMParser)
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
                            DbManager.update(received.name, received.reasoner);
                        }
                        defer.resolve(received);
                    }

                    return defer.promise;
                }
            };
        }]);
