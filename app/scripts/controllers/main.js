'use strict';

/**
 * @ngdoc function
 * @name owlReasonerApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the owlReasonerApp
 */
app.controller('MainCtrl',

    function ($scope, $http, $q, OntologyClassifier, OntologyFetcher, OntologyParser, QueryProcessor, ReasoningService) {

        $scope.frontReasoner = {
            'reasoner': localStorage.getItem('reasoner'),
            'classification': 'server',
            'inWorker': true,
            'querying': 'client',
            'workerlog':  [],
            'owlFileName': 'Keywords_WWW2012_V3_min.owl',
            'isLoading': false,
            'status': 'Ready',
            'query': 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> select ?o { <#Spatial-temporal_systems> <rdf:type> ?o }'
        };

        var postLog = function(msg, isError, toggleLoads) {
                $scope.frontReasoner.workerlog.push({
                    'time': new Date().getTime(),
                    'msg':  msg,
                    'isError': isError
                });

                if(toggleLoads) toggleLoading();
            },

            toggleLoading = function() {
                $scope.frontReasoner.isLoading = !$scope.frontReasoner.isLoading;
            },

            processMessage = function(message) {
                if(message) {
                    if (message.msg) postLog(message.msg, message.isError, message.toggleLoads);
                    if (message.sparqlResults) $scope.frontReasoner.sparqlResults = message.sparqlResults;
                }
            };

        $scope.removeReasoner = function() {
            localStorage.removeItem('reasoner');
            $scope.frontReasoner.reasoner = localStorage.getItem('reasoner');
        };


        $scope.getOwl = function() {
            if(this.frontReasoner.owlFileName.match(/.*\.owl$/i)) {
                this.frontReasoner.owlFileLocation = 'http://localhost:3000/ontologies/' + this.frontReasoner.owlFileName;
            }
        };

        $scope.startWorker = function() {

            if(this.frontReasoner.owlFileLocation && !this.frontReasoner.isLoading) {

                postLog("Initializing...", false, true);
                var promise;

                if(this.frontReasoner.classification == 'server') {
                    promise = OntologyClassifier.classify({
                            filename: this.frontReasoner.owlFileName,
                            time: new Date().getTime()
                        }).$promise;
                } else {
                    promise = OntologyFetcher.fetch({
                        filename: this.frontReasoner.owlFileName,
                        time: new Date().getTime()
                    }).$promise;
                }

                promise.then(
                    function (response) {
                        var data = response.data,
                            responseDelay = new Date().getTime() - data.time,
                            startTime = new Date().getTime();

                        data.command = 'start';
                        data.inWorker = $scope.frontReasoner.inWorker;

                        ReasoningService
                            .process(data)
                            .then(function(message) {
                                processMessage(message);
                                postLog('Requesting time : ' + data.requestDelay);
                                postLog('Response delay : ' + responseDelay);
                                postLog('Classifying time : ' + (data.processingDelay || new Date().getTime() - startTime));
                                $scope.frontReasoner.reasoner = localStorage.getItem('reasoner');
                            });
                    },
                    function (err) {
                        postLog("OWL Parsing failed. " + err.data, true, true);
                    }
                );

            } else {
                postLog('Busy', true);
            }
        };

        $scope.executeQuery = function() {

            if($scope.frontReasoner.querying == 'client' && !localStorage.getItem('reasoner')) {
                postLog("Client-side reasoner not ready ", true, false);
                return;
            }

            var promise;
            postLog("Evaluating query ... ", false, true);

            if($scope.frontReasoner.querying == 'client') {
                promise = ReasoningService.process({
                    command: 'process',
                    reasoner: localStorage.getItem('reasoner'),
                    sparqlQuery: this.frontReasoner.query,
                    inWorker: this.frontReasoner.inWorker
                });
            } else {
                promise = QueryProcessor.query({
                    query: this.frontReasoner.query,
                    time: new Date().getTime(),
                    inWorker: this.frontReasoner.inWorker
                }).$promise;
            }

            promise.then(function(response) {
                    var responseDelay = new Date().getTime() - response.time;
                    postLog(response.data.length + ' results.', false, true);
                    response.requestDelay && postLog('Requesting time : ' + response.requestDelay, false, false);
                    responseDelay && postLog('Response delay : ' + responseDelay, false, false);
                    postLog('Querying processing time : ' + response.processingDelay, false, false);
                },
                function(response) {
                    postLog(response.data.data, true, true);
                });
        };

        $scope.getOwl();

  });
