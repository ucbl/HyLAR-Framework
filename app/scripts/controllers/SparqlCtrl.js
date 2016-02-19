/**
 * Created by pc on 18/02/2016.
 */

app.controller('SparqlCtrl', function($scope, Hylar) {

    $scope.$watch(function() {
        return Hylar.config.query;
    }, function() {
        $scope.query = Hylar.config.query;
    });

    $scope.$watch(function() {
        return $scope.query;
    }, function() {
        Hylar.config.query= $scope.query;
    });

    $scope.ungraph = function() {
        Hylar.config.query = Hylar.config.query.replace(/(FROM NAMED .+)+(\{ .+ \})/g, '$2');
        Hylar.config.query = Hylar.config.query.replace(/(GRAPH <.+> \{ )(.+)( \})/g, '$2');
    };

    $scope.deletize = function() {
        Hylar.config.query = Hylar.config.query.replace(/INSERT DATA/g, 'DELETE DATA');
    };

    $scope.insert10 = function() {
        Hylar.config.query = Hylar.exampleReq.insert10;
    };
    $scope.insert20 = function() {
        Hylar.config.query = Hylar.exampleReq.insert20;
    };
    $scope.insert30 = function() {
        Hylar.config.query = Hylar.exampleReq.insert30;
    };
    $scope.insert40 = function() {
        Hylar.config.query = Hylar.exampleReq.insert40;
    };
    $scope.insert50 = function() {
        Hylar.config.query = Hylar.exampleReq.insert50;
    };
    $scope.delete10 = function() {
        $scope.insert10();
        $scope.deletize();
    };
    $scope.delete20 = function() {
        $scope.insert20();
        $scope.deletize();
    };
    $scope.delete30 = function() {
        $scope.insert30();
        $scope.deletize();
    };
    $scope.delete40 = function() {
        $scope.insert40();
        $scope.deletize();
    };
    $scope.delete50 = function() {
        $scope.insert50();
        $scope.deletize();
    };
    $scope.select_all = function() {
        Hylar.config.query = Hylar.exampleReq.select_all;
    };
    $scope.select10 = function() {
        Hylar.config.query = Hylar.exampleReq.select10;
    };
    $scope.select20 = function() {
        Hylar.config.query = Hylar.exampleReq.select20;
    };
    $scope.select30 = function() {
        Hylar.config.query = Hylar.exampleReq.select30;
    };
    $scope.select40 = function() {
        Hylar.config.query = Hylar.exampleReq.select40;
    };
    $scope.select50 = function() {
        Hylar.config.query = Hylar.exampleReq.select50;
    };

});
