/**
 * Created by Spadon on 14/10/2014.
 */

var CONFIG = {};

/**
 * Main task
 */
function startReasoner(data) {

    /**
     * Creating a reasoner object for the given ontology
     */
    try {
        var reasoner, stringifiedReasoner, endMsg, errMsg,
            seen = [];
        // If the reasoner has been already initialized
        if(data.reasoner) {
            reasoner = data.reasoner;
        // If the classification is done client side
        } else {
            reasoner = new BrandT(data);
        }

        stringifiedReasoner = JSON.stringify(reasoner, function(key, val) {
            if (val != null && typeof val == "object") {
                if (seen.indexOf(val) >= 0)
                    return;
                seen.push(val)
            }
            return val
        });

        CONFIG.rdf = data.rdf;
        endMsg = {
            msg: "Reasoner ready. " + reasoner.aBox.database.ClassAssertion.length + " class assertions, " + reasoner.aBox.database.ObjectPropertyAssertion.length + " object property assertions.",
            toggleLoads:true,
            reasoner: stringifiedReasoner,
            name: data.name
        };

        if(data.inWorker) {
            send(endMsg);
        } else {
            return endMsg;
        }

    } catch(err) {
        errMsg = {
            msg: "Reasoner unavailable. " + err.toString(),
            name: data.name,
            isError:true,
            toggleLoads: true
        };

        if(data.inWorker) {
            send(errMsg);
        } else {
            return errMsg;
        }
    }
}

function queryReasoner(queryString, reasoner, inWorker) {
    /**
     * Creating SPARQL query
     */

    try {
        var errMsg, query = sparql.parse(queryString);
    } catch(err) {
        errMsg = {
            msg: "SPARQL parsing failed. " + err.toString(),
            isError:true,
            toggleLoads: true
        };

        if(inWorker) {
            send(errMsg);
        } else {
            return errMsg;
        }
    }


    /**
     * Querying the reasoner
     */

    try {
        var results, before, processingDelay, endMsg, errMsg;

        reasoner.aBox.__proto__ = TrimQueryABox.prototype;
        before = new Date().getTime();
        results = reasoner.aBox.answerQuery(query);
        processingDelay = new Date().getTime() - before;
        endMsg = {
            data: results,
            processingDelay: processingDelay,
            toggleLoads: true
        };

        if(inWorker) {
            send(endMsg);
        } else {
            return endMsg;
        }
    } catch(err) {

        errMsg = {
            msg: 'Error while evaluating. ' + err.toString(),
            isError: true,
            toggleLoads: true
        };

        if(inWorker) {
            send(errMsg);
        } else {
            return errMsg;
        }
    }

}