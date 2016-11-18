import { Component } from '@angular/core';

@Component({
    selector: 'my-app',
    template: `
        <header>
            <nav class="navbar navbar-default navbar-fixed-right" role="navigation">
                <div class="container-fluid">
                    <div class="navbar-header">
                        <a class="navbar-brand">
                            <img style="float: left; max-width:100%; max-height:100%;" src="favicon.ico"/>
                            &nbsp;
                            HyLAR-Framework
                        </a>
                    </div>            
                </div>
            </nav>
        </header>
    <router-outlet></router-outlet>`
})

export class AppComponent {    
    
}
