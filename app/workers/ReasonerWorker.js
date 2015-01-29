/**
 * Created by Spadon on 06/10/2014.
 */

importScripts('../scripts/reasoning/JswRDFQuery.js');
importScripts('../scripts/reasoning/JswReasoner.js');
importScripts('../scripts/reasoning/JswXSD.js');
importScripts('../scripts/reasoning/JswSPARQL.js');
importScripts('../scripts/reasoning/owlreasoner_common.js');

function send(data) {
    postMessage(data);
}

self.onmessage = function(event) {
    var data = JSON.parse(event.data);
    if(data.command === "start") {
        startReasoner(data);
    } else if(data.command === "process") {
        queryReasoner(data.sparqlQuery, data.reasoner);
    }
};