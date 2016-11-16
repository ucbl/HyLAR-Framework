import { Injectable, Input } from '@angular/core';

declare var Hylar: any;

@Injectable()

export class AdaptationService {

    public getClassificationLocation(thresholds:any,current:any) {        
        let rules = [
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type OntologySize) ^ (?s > ${thresholds.ontologySize}) -> (Classification location Server)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s <= ${thresholds.batteryLevel}) -> (Classification location Server)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type OntologySize) ^ (?s <= ${thresholds.ontologySize}) ^ (?s2 http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s2 > ${thresholds.batteryLevel}) -> (Classification location Client)`,

            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type Ping) ^ (?s > ${thresholds.ping}) -> (Querying location Client)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s > ${thresholds.batteryLevel}) -> (Querying location Client)`,
            `(?s http://www.w3.org/1999/02/22-rdf-syntax-ns#type Ping) ^ (?s <= ${thresholds.ping}) ^ (?s2 http://www.w3.org/1999/02/22-rdf-syntax-ns#type BatteryLevel) ^ (?s2 <= ${thresholds.batteryLevel}) -> (Querying location Server)`,

        ]
    }
}