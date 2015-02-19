'use strict';

/**
 * @ngdoc function
 * @name owlReasonerApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the owlReasonerApp
 */
app.controller('MainCtrl',

    function ($scope, $http, $q,
              OntologyClassifier, OntologyFetcher, QueryProcessor, RemoteOntologies, ServerTime,
              OntologyParser, ReasoningService, LoggingService,
              FileUploader) {

        $scope.updateList = function() {
            $scope.ontologyList = RemoteOntologies.getList();
        };

        $scope.uploader = new FileUploader();
        $scope.uploader.url = angular.injector(['config']).get('ENV').serverRootPath +  '/ontology';
        $scope.uploader.autoUpload = true;
        $scope.uploader.onSuccessItem = function() {
            LoggingService.postLog('Your file has been sucessfully uploaded. You can choose it on the list !', false, false);
            $scope.updateList();
        };

        $scope.frontReasoner = {
            'reasoner': localStorage.getItem('reasoner'),
            'classification': 'server',
            'inWorker': true,
            'querying': 'client',
            'workerlog':  LoggingService.log,
            'owlFileName': 'test.owl',
            'isLoading': false,
            'status': 'Ready',
            'query': 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> select ?o { <#Spatial-temporal_systems> <rdf:type> ?o }'
        };

        var processMessage = function(message) {
            if(message) {
                if (message.msg) LoggingService.postLog(message.msg, message.isError, message.toggleLoads);
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

                LoggingService.postLog("Initializing...", false, true);
                var promise;

                ServerTime.getServerTime().$promise.then(function(time) {

                    if($scope.frontReasoner.classification == 'server') {
                        promise = OntologyClassifier.classify({
                            filename: $scope.frontReasoner.owlFileName,
                            time: time.milliseconds
                        }).$promise;
                    } else {
                        promise = OntologyFetcher.fetch({
                            filename: $scope.frontReasoner.owlFileName,
                            time: time.milliseconds
                        }).$promise;
                    }

                    promise.then(
                        function (response) {
                            ServerTime.getServerTime().$promise.then(function(time) {
                                var data = response.data,
                                    responseDelay = time.milliseconds - data.time,
                                    startTime = time.milliseconds;

                                data.command = 'start';
                                data.inWorker = $scope.frontReasoner.inWorker;

                                ReasoningService
                                    .process(data)
                                    .then(function(message) {
                                        ServerTime.getServerTime().$promise.then(function(time) {
                                            processMessage(message);
                                            LoggingService.postLog('Requesting time : ' + data.requestDelay);
                                            LoggingService.postLog('Response delay : ' + responseDelay);
                                            LoggingService.postLog('Classifying time : ' + (data.processingDelay || time.milliseconds - startTime));
                                            $scope.frontReasoner.reasoner = localStorage.getItem('reasoner');
                                        });
                                    });
                            });


                        },
                        function (err) {
                            LoggingService.postLog("OWL Parsing failed. " + err.data, true, true);
                        }
                    );

                });

            } else {
                LoggingService.postLog('Busy', true);
            }
        };

        $scope.executeQuery = function() {

            if($scope.frontReasoner.querying == 'client' && !localStorage.getItem('reasoner')) {
                LoggingService.postLog("Client-side reasoner not ready ", true, false);
                return;
            }

            var promise;
            LoggingService.postLog("Evaluating query ... ", false, true);

            ServerTime.getServerTime().$promise.then(function(time) {
                if($scope.frontReasoner.querying == 'client') {
                    promise = ReasoningService.process({
                        command: 'process',
                        reasoner: localStorage.getItem('reasoner'),
                        sparqlQuery: $scope.frontReasoner.query,
                        inWorker: $scope.frontReasoner.inWorker
                    });
                } else {
                    promise = QueryProcessor.query({
                        query: $scope.frontReasoner.query,
                        time: time.milliseconds,
                        inWorker: $scope.frontReasoner.inWorker
                    }).$promise;
                }

                promise.then(function(response) {
                    ServerTime.getServerTime().$promise.then(function(time) {
                            var responseDelay = time.milliseconds - response.time;
                            LoggingService.postLog(response.data.length + ' results.', false, true);
                            response.requestDelay && LoggingService.postLog('Requesting time : ' + response.requestDelay, false, false);
                            responseDelay && LoggingService.postLog('Response delay : ' + responseDelay, false, false);
                            LoggingService.postLog('Querying processing time : ' + response.processingDelay, false, false);
                        },
                        function(response) {
                            LoggingService.postLog(response.data.data, true, true);
                        });
                });
            });
        };

        $scope.getOwl();
        $scope.updateList();

  });
