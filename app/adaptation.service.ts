import { Injectable } from '@angular/core';

declare var ReasoningEngine: any, Logics: any, Fact: any;

@Injectable()

export class AdaptationService {

    public getReasoningLocations(thresholds:any,current:any,callback:Function) {        
        let rules = [
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type OntologySize) ^ (?s > "${thresholds.ontologySize}") -> (Classification location server)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s <= "${thresholds.batteryLevel}") -> (Classification location server)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type OntologySize) ^ (?s <= "${thresholds.ontologySize}") ^ (?s2 http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s2 > "${thresholds.batteryLevel}") -> (Classification location client)`,

            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type Ping) ^ (?s > "${thresholds.ping}") -> (Querying location client)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s > "${thresholds.batteryLevel}") -> (Querying location client)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type Ping) ^ (?s <= "${thresholds.ping}") ^ (?s2 http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s2 <= "${thresholds.batteryLevel}") -> (Querying location server)`,

        ],
        facts = [
            new Fact("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `"${current.ontologySize}"`,"OntologySize"),
            new Fact("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `"${current.batteryLevel}"`,"BatteryLevel"),
            new Fact("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `"${current.ping}"`,"Ping")
        ];

        ReasoningEngine.incremental(facts, [], [], Logics.parseRules(rules))
        .then(function(results) {            
            callback({ classification: results.additions[3].object, querying: results.additions[4].object });
        });
    }
}