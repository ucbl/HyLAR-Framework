/**
 * Created by Spadon on 06/10/2014.
 */

importScripts('./ReasonerReceive.js');
importScripts('../scripts/reasoning/jsw.js');
importScripts('../scripts/reasoning/JswReasoner.js');

function send(data) {
    postMessage(data);
}

self.onmessage = receive;
