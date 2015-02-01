/**
 * Created by Spadon on 06/10/2014.
 */

importScripts('../scripts/reasoning/JswRDFQuery.js');
importScripts('../scripts/reasoning/JswReasoner.js');
importScripts('../scripts/reasoning/JswXSD.js');
importScripts('../scripts/reasoning/JswSPARQL.js');
importScripts('./ReasonerReceive.js');
importScripts('../scripts/reasoning/owlreasoner_common.js');

function send(data) {
    postMessage(data);
}

self.onmessage = receive;