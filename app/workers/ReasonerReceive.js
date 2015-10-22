/**
 * Created by Spadon on 30/01/2015.
 */

function receive(event) {
    var data = JSON.parse(event.data);
    if(data.command === "start") {
        return startReasoner(data);
    } else if(data.command === "process") {
        return queryReasoner(data.sparqlQuery, data.inWorker, data.reasoningMethod);
    }
}