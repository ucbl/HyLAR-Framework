/**
 * Created by Spadon on 13/02/2015.
 */

var _ = require('lodash');

module.exports = {

    getKeyByValue: function(obj, value) {
        for(var prop in obj) {
            if(obj.hasOwnProperty(prop) ) {
                if(obj[prop] === value )
                    return obj;
            }
        }
        return false;
    },

    completeMap: function(mapToComplete, mapCompleter) {
        var newMap = {}
        for(var key in mapToComplete) {
            newMap[key] = mapToComplete[key];
        }
        for(var key in mapCompleter) {
            var candidate = mapCompleter[key];
            if(!(this.getKeyByValue(newMap,candidate))) newMap[key] = mapCompleter[key];
        }
        return newMap;
    },

    subsetOf: function(arr1, arr2) {
        for (var key in arr2) {
            if (JSON.stringify(arr1).indexOf(JSON.stringify(arr2[key]) === -1)) return false;
        }
        return true;
    },

    diff: function(arr1, arr2) {
        var result = [];
        for (var key in arr1) {
            var obj_arr1 = arr1[key];
            if(!_.find(arr2, obj_arr1)) {
                result.push(obj_arr1);
            }
        }
        return result;
    },

    uniqConcat: function(arr1, arr2) {
        var bigger, lower;

        if(arr1.length > arr2.length) {
            bigger = _.cloneDeep(arr1);
            lower = _.cloneDeep(arr2);
        } else {
            bigger = _.cloneDeep(arr2);
            lower = _.cloneDeep(arr1);
        }

        for(var key in lower) {
            if(JSON.stringify(bigger).indexOf(JSON.stringify(lower[key])) === -1) {
                bigger.push(lower[key]);
            }
        }
        return bigger;
    },

    /**
     * Simple HelloWorld
     * @param req
     * @param res
     */
    hello: function(req, res) {
        res.send('hello world');
    },

    /**
     * CORS Middleware
     * @param req
     * @param res
     */
    allowCrossDomain: function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    },

    /** Current server time */
    time: function(req, res) {
        res.send({
            milliseconds: new Date().getTime()
        });
    }

};
