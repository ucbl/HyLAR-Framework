/**
 * Created by Spadon on 13/02/2015.
 */

var _ = require('lodash');

module.exports = {

    booleize: function(str) {
        if (str === 'true') {
            return true;
        } else {
            return false;
        }
    },

    /**
     * Transforms a object into a stringified version
     * and replaces commas by '-' to avoid TrimPath exceptions.
     * @param json
     * @returns {*}
     */
    stringifyNoComma: function(json) {
        if(json.length == 0) return '';
        var str =JSON.stringify(json);
        return str.replace(/",/g, '"-')
                .replace(/},/g, '}-')
                .replace(/],/g, ']-');
    },

    /**
     * Reversed stringifyNoComma function.
     * @param str
     */
    unStringifyAddCommas: function(str) {
        try {
            return JSON.parse(str.replace(/]-/g, '],')
                .replace(/}-/g, '},')
                .replace(/"-/g, '",'));
        } catch(e) {
            return [];
        }
    },

    /**
     * Get the key referring to a value in a JSON object.
     * @param obj
     * @param value
     * @returns {*}
     */
    getKeyByValue: function(obj, value) {
        for(var prop in obj) {
            if(obj.hasOwnProperty(prop) ) {
                if(obj[prop] === value )
                    return obj;
            }
        }
        return false;
    },

    /**
     * Merges two maps.
     * @param mapToComplete
     * @param mapCompleter
     * @returns {{}}
     */
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

    /**
     * Concat collection without duplicates (cloning).
     * @param arr1
     * @param arr2
     * @returns {*}
     */
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
