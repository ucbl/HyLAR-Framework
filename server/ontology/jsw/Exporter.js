/**
 * Created by Spadon on 02/12/2014.
 */

var q = require('q'),
    fs = require('fs');

module.exports = {
    getJsExports: function() {
        var deferred = q.defer();

        fs.readFile('./server/ontology/jsw/JswTrimQueryABox.js', 'utf-8', function (err, aBoxFile) {
            fs.readFile('./server/ontology/jsw/TrimPathQuery.js', 'utf-8', function(err, trimQueryFile) {
                deferred.resolve(aBoxFile + '\n' + trimQueryFile);
            });
        });

        return deferred.promise;
    }
};