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
              HylarRemote, ServerTime,
              OntologyParser, ReasoningService, LoggingService, Hylar,
              FileUploader) {

        $scope.updateList = function() {
            $scope.ontologyList = HylarRemote.list;
        };

        $scope.uploader = new FileUploader();
        $scope.uploader.url = angular.injector(['config']).get('ENV').serverRootPath +  '/ontology';
        $scope.uploader.autoUpload = true;
        $scope.uploader.onSuccessItem = function() {
            LoggingService.msg('Your file has been sucessfully uploaded. You can choose it on the list !').submit();
            $scope.updateList();
        };

        $scope.frontReasoner = {
            'reasoner': localStorage.getItem('reasoner'),
            'classification': 'server',
            'inWorker': true,
            'querying': 'client',
            'workerlog':  LoggingService.log,
            'owlFileName': 'test.owl',
            'isLoading': Hylar.status,
            'status': 'Ready',
            'query': 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> select ?o { <#Spatial-temporal_systems> <rdf:type> ?o }'
        };

        var processMessage = function(data) {
            if (data && data.msg) {
                if(data.isError) {
                    LoggingService.err(data.msg)
                } else LoggingService.msg(data.msg);
                LoggingService.submit();
            } else if (data && data.sparqlResults) {
                $scope.frontReasoner.sparqlResults = data.sparqlResults;
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

                LoggingService.msg('Initializing...').submit();
                var promise;

                ServerTime.getServerTime().$promise.then(function(time) {

                    if($scope.frontReasoner.classification == 'server') {
                        promise = HylarRemote.classify({
                            filename: $scope.frontReasoner.owlFileName,
                            time: time.milliseconds
                        }).$promise;
                    } else {
                        promise = HylarRemote.fetch({
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
                                            var classifyingTime = data.processingDelay || time.milliseconds - startTime;
                                            processMessage(message);
                                            LoggingService.msg('Requesting time : ' + data.requestDelay).submit();
                                            LoggingService.msg('Response delay : ' + responseDelay).submit();
                                            LoggingService.msg('Classifying time : ' + classifyingTime).submit();
                                            $scope.frontReasoner.reasoner = localStorage.getItem('reasoner');
                                        });
                                    });
                            });


                        },
                        function (err) {
                            LoggingService.err('OWL Parsing failed. ' + err.data).submit();
                        }
                    );

                });

            } else {
                LoggingService.err('Busy').submit();
            }
        };

        $scope.executeQuery = function() {

            if($scope.frontReasoner.querying == 'client' && !localStorage.getItem('reasoner')) {
                LoggingService.err('Client-side reasoner not ready').submit();
                return;
            }

            var promise;
            LoggingService.msg('Evaluating query ... ').submit();

            ServerTime.getServerTime().$promise.then(function(time) {
                if($scope.frontReasoner.querying == 'client') {
                    promise = ReasoningService.process({
                        command: 'process',
                        reasoner: localStorage.getItem('reasoner'),
                        sparqlQuery: $scope.frontReasoner.query,
                        inWorker: $scope.frontReasoner.inWorker
                    });
                } else {
                    promise = HylarRemote.query({
                        query: $scope.frontReasoner.query,
                        time: time.milliseconds,
                        inWorker: $scope.frontReasoner.inWorker
                    }).$promise;
                }

                promise.then(function(response) {
                    ServerTime.getServerTime().$promise.then(function(time) {
                            var responseDelay = time.milliseconds - response.time;
                            LoggingService.msg(response.data.length + ' results.').submit();
                            response.requestDelay && LoggingService.msg('Requesting time : ' + response.requestDelay).submit();
                            responseDelay && LoggingService.msg('Response delay : ' + responseDelay).submit();
                            LoggingService.msg('Querying processing time : ' + response.processingDelay).submit();
                        },
                        function(response) {
                            LoggingService.err(response.data.data).submit();
                        });
                });
            });
        };

        $scope.getOwl();
        $scope.updateList();

  });
