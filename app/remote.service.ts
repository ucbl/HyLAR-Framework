import { Injectable } from '@angular/core';
import { Http, Headers, Response, Request } from '@angular/http';

@Injectable()

export class RemoteService {
    constructor(private http:Http) { }

    public getServerTime(address:string, callback:Function) {
        let request = this.http.get(address);

        request
            .map((time:Response) => time.json())
            .subscribe(time => {
                callback(time.ms);
            });
    }
}