'use strict';

/**
 * @ngdoc function
 * @name owlReasonerApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the owlReasonerApp
 */
app.controller('MainCtrl',

    function ($scope, $http, $q, $timeout, upload,
              Hylar, ServerTime, LoggingService,
              FileUploader, AdaptationService) {

        $scope.adaptationParameters = AdaptationService.parameters;
        $scope.updateTooltip = function () {
            AdaptationService.regenerateRules();
            $scope.ruleDesc = AdaptationService.ruleDesc.queryingLocation +
                AdaptationService.ruleDesc.classifLocation;
        };

        $scope.setAdaptationParameters = function() {
            AdaptationService.parameters = this.adaptationParameters;
            $scope.updateTooltip();
        };

        (function updateList() {
            var that = $scope;
            Hylar.remote.list().$promise.then(function (list) {
                console.log(list.length);
                that.ontologyList = list;
                $timeout(updateList, 200);
            });
        })();

        $scope.clearLog = function() {
            LoggingService.log = [];
        };

        $scope.uploadUrl = angular.injector(['config']).get('ENV').serverRootPath +  '/ontology';
        $scope.successUpload = function(response) {
            LoggingService.msg('Your file has been sucessfully uploaded. You can choose it on the list !').submit();
            $scope.owlFileName = response.data.filename;

        };

        $scope.config = Hylar.config;
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

        $scope.deleteFile = function() {
            var that = this;
            Hylar.remote.delete({
                filename:  that.owlFileName
            }).$promise.then(
                function(success) {
                    LoggingService.msg(success.filename + ' successfully deleted.').submit();
                },
                function(err) {
                    LoggingService.err(err.statusText).submit();
                });
        };

        $scope.startWorker = function() {
            var that = this,
                classif = Hylar.config.classification;
            AdaptationService.answerClassificationLocationQuestion(that.owlFileName, classif).then(function(res) {
                if (classif == 'auto') {
                    classif = res.location;
                    LoggingService.msg('The ontology contains ' + res.status.ontologySize + ' entities, the battery level is '
                        + res.status.batteryLevel*100 + '% and the ping is ' + res.status.ping + ' ms.').submit();
                    LoggingService.msg('Classification on the ' + res.location + ' side.').submit()
                }

                if (that.owlFileName) {
                    var promise,
                        filename = that.owlFileName;
                    LoggingService.msg('Initializing...').submit();

                    ServerTime.getServerTime().$promise.then(function (time) {

                        if (classif == 'server') {
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
                                ServerTime.getServerTime().$promise.then(function (time) {
                                    var data = response.data,
                                        responseDelay = time.milliseconds - data.time,
                                        startTime = time.milliseconds;

                                    data.command = 'start';
                                    data.inWorker = Hylar.config.inWorker;
                                    data.reasoningMethod = $scope.config.reasoningMethod;

                                    try {
                                        Hylar.client.process(data).then(function (message) {
                                            ServerTime.getServerTime().$promise.then(function (time) {
                                                var classifyingTime = data.processingDelay || time.milliseconds - startTime;
                                                processMessage(message);
                                                LoggingService.msg('Requesting time : ' + data.requestDelay).submit();
                                                LoggingService.msg('Response delay : ' + responseDelay).submit();
                                                LoggingService.msg('Classifying time : ' + classifyingTime).submit();
                                                $scope.config.reasoner = localStorage.getItem('reasoner');
                                            });
                                        });
                                    } catch(err) {
                                        LoggingService.err(err).submit();
                                    }
                                });
                            },
                            function (err) {
                                LoggingService.err(err.data.toString()).submit();
                            }
                        );

                    });

                }
            });
        };

        $scope.executeQuery = function() {
            var that = this, promise, resultMsg, responseDelay,
                querying = Hylar.config.querying;

            AdaptationService.answerQueryAnsweringLocationQuestion(that.owlFileName, querying).then(function(res) {
                if (Hylar.config.querying == 'auto') {
                    querying = res.location;
                    LoggingService.msg('The ontology contains ' + res.status.ontologySize + ' entities, the battery level is '
                        + res.status.batteryLevel*100 + '% and the ping is ' + res.status.ping + ' ms.').submit();
                    LoggingService.msg('Querying on the ' + res.location + ' side.').submit()
                }

                if(querying == 'client' && !localStorage.getItem('reasoner')) {
                    LoggingService.err('Client-side reasoner not ready').submit();
                    return;
                }

                LoggingService.msg('Evaluating query ... ').submit();

                ServerTime.getServerTime().$promise.then(function(time) {
                    if(querying == 'client') {
                        promise = Hylar.client.process({
                            command: 'process',
                            reasoner: localStorage.getItem('reasoner'),
                            sparqlQuery: Hylar.config.query,
                            inWorker: Hylar.config.inWorker,
                            reasoningMethod: $scope.config.reasoningMethod
                        });
                    } else {
                        promise = Hylar.remote.query({
                            query: Hylar.config.query,
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

                                $scope.sparqlResults = [];

                                if(Hylar.config.query.toLowerCase().indexOf('insert') !== -1) {
                                    resultMsg = 'Insertion sucessful. KB now contains ' + response.data.length + ' triple(s).'
                                } else if(Hylar.config.query.toLowerCase().indexOf('delete') !== -1) {
                                    resultMsg = 'Deletion sucessful. KB now contains ' + response.data.length + ' triple(s).'
                                } else {
                                    resultMsg = response.data[0].length + ' results.';
                                    $scope.sparqlResults = response.data;
                                }

                                responseDelay = time.milliseconds - response.time;
                                LoggingService.msg(resultMsg).submit();
                                response.requestDelay && LoggingService.msg('Requesting time : ' + response.requestDelay).submit();
                                responseDelay && LoggingService.msg('Response delay : ' + responseDelay).submit();
                                LoggingService.msg('Querying processing time : ' + response.processingDelay).submit();
                            }
                        });
                    });
                });
            });

        };

        $scope.owlFileName = 'fipa.owl';
        $scope.updateTooltip();

    });
