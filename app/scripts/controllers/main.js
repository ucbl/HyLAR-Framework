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
              Hylar,
              ServerTime, LoggingService,
              FileUploader) {

        $scope.clearLog = function() {
            LoggingService.log = [];
        };

        $scope.ungraph = function() {
            $scope.query = $scope.query.replace(/(FROM NAMED .+)+(\{ .+ \})/g, '$2');
            $scope.query = $scope.query.replace(/(GRAPH <.+> \{ )(.+)( \})/g, '$2');
        };

        $scope.deletize = function() {
            $scope.query = $scope.query.replace(/INSERT DATA/g, 'DELETE DATA');
        };

        $scope.insert10 = function() {
            $scope.query = Hylar.exampleReq.insert10;
        };
        $scope.insert20 = function() {
            $scope.query = Hylar.exampleReq.insert20;
        };
        $scope.insert30 = function() {
            $scope.query = Hylar.exampleReq.insert30;
        };
        $scope.insert40 = function() {
            $scope.query = Hylar.exampleReq.insert40;
        };
        $scope.insert50 = function() {
            $scope.query = Hylar.exampleReq.insert50;
        };
        $scope.select_all = function() {
            $scope.query = Hylar.exampleReq.select_all;
        };
        $scope.select10 = function() {
            $scope.query = Hylar.exampleReq.select10;
        };
        $scope.select20 = function() {
            $scope.query = Hylar.exampleReq.select20;
        };
        $scope.select30 = function() {
            $scope.query = Hylar.exampleReq.select30;
        };
        $scope.select40 = function() {
            $scope.query = Hylar.exampleReq.select40;
        };
        $scope.select50 = function() {
            $scope.query = Hylar.exampleReq.select50;
        };

        $scope.updateList = function() {
            $scope.ontologyList = Hylar.remote.list;
        };

        $scope.uploader = new FileUploader();
        $scope.uploader.url = angular.injector(['config']).get('ENV').serverRootPath +  '/ontology';
        $scope.uploader.autoUpload = true;
        $scope.uploader.onSuccessItem = function() {
            LoggingService.msg('Your file has been sucessfully uploaded. You can choose it on the list !').submit();
            $scope.updateList();
        };

        $scope.config = Hylar.config;
        $scope.query =  'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
                        'SELECT ?a ?b { ?a rdfs:subClassOf ?b }'
                        ;
        $scope.owlFileName = 'fipa.owl';
        $scope.workerlog = LoggingService.log;

        var processMessage = function(data) {
            if (data && data.msg) {
                if(data.isError) {
                    LoggingService.err(data.msg)
                } else LoggingService.msg(data.msg);
                LoggingService.submit();
            } else if (data && data.sparqlResults) {
                $scope.sparqlResults = data.sparqlResults;
            }

        };

        $scope.removeReasoner = function() {
            localStorage.removeItem('reasoner');
            $scope.config.reasoner = localStorage.getItem('reasoner');
        };

        $scope.startWorker = function() {

            if(this.owlFileName) {
                var promise,
                    filename = this.owlFileName;
                LoggingService.msg('Initializing...').submit();

                ServerTime.getServerTime().$promise.then(function(time) {

                    if(Hylar.config.classification == 'server') {
                        promise = Hylar.remote.classify({
                            filename: filename,
                            time: time.milliseconds,
                            reasoningMethod: $scope.config.reasoningMethod
                        }).$promise;
                    } else {
                        promise = Hylar.remote.fetch({
                            filename: filename,
                            time: time.milliseconds,
                            reasoningMethod: $scope.config.reasoningMethod
                        }).$promise;
                    }

                    promise.then(
                        function (response) {
                            ServerTime.getServerTime().$promise.then(function(time) {
                                var data = response.data,
                                    responseDelay = time.milliseconds - data.time,
                                    startTime = time.milliseconds;

                                data.command = 'start';
                                data.inWorker = Hylar.config.inWorker;
                                data.reasoningMethod = $scope.config.reasoningMethod;

                                Hylar.client.process(data).then(function(message) {
                                        ServerTime.getServerTime().$promise.then(function(time) {
                                            var classifyingTime = data.processingDelay || time.milliseconds - startTime;
                                            processMessage(message);
                                            LoggingService.msg('Requesting time : ' + data.requestDelay).submit();
                                            LoggingService.msg('Response delay : ' + responseDelay).submit();
                                            LoggingService.msg('Classifying time : ' + classifyingTime).submit();
                                            $scope.config.reasoner = localStorage.getItem('reasoner');
                                        });
                                    });
                            });


                        },
                        function (err) {
                            LoggingService.err('OWL Parsing failed. ' + err.data).submit();
                        }
                    );

                });

            }
        };

        $scope.executeQuery = function() {

            if(Hylar.config.querying == 'client' && !localStorage.getItem('reasoner')) {
                LoggingService.err('Client-side reasoner not ready').submit();
                return;
            }

            var promise,
                query = this.query;
            LoggingService.msg('Evaluating query ... ').submit();

            ServerTime.getServerTime().$promise.then(function(time) {
                if(Hylar.config.querying == 'client') {
                    promise = Hylar.client.process({
                        command: 'process',
                        reasoner: localStorage.getItem('reasoner'),
                        sparqlQuery: query,
                        inWorker: Hylar.config.inWorker,
                        reasoningMethod: $scope.config.reasoningMethod
                    });
                } else {
                    promise = Hylar.remote.query({
                        query: query,
                        time: time.milliseconds,
                        inWorker: Hylar.config.inWorker,
                        reasoningMethod: $scope.config.reasoningMethod
                    }).$promise;
                }

                promise.then(function(response) {
                    ServerTime.getServerTime().$promise.then(function (time) {
                        if(response.isError) {
                            LoggingService.err(response.msg).submit();
                        } else {
                            var responseDelay = time.milliseconds - response.time;
                            $scope.sparqlResults = response.data;
                            LoggingService.msg($scope.sparqlResults.length + ' results.').submit();
                            response.requestDelay && LoggingService.msg('Requesting time : ' + response.requestDelay).submit();
                            responseDelay && LoggingService.msg('Response delay : ' + responseDelay).submit();
                            LoggingService.msg('Querying processing time : ' + response.processingDelay).submit();
                        }
                    });
                });
            });
        };

        $scope.updateList();

  });
