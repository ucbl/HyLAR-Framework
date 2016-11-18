import { Component, enableProdMode } from '@angular/core';
enableProdMode();

@Component({
    selector: 'my-app',
    template: `
        <header>
            <nav class="navbar navbar-default navbar-fixed-right" role="navigation">
                <div class="container-fluid">
                    <div class="navbar-header">
                        <a href="/" class="navbar-brand">
                            <img style="float: left; max-width:100%; max-height:100%;" src="favicon.ico"/>
                            &nbsp;
                            HyLAR-Framework
                        </a>
                        <a href="/rules" target="_blank" onclick="window.open(this.href, 'mywin','left=20,top=20,width=50%,resizable=0'); return false;" class="navbar-brand">                            
                            &nbsp;
                            Rules
                        </a>
                    </div>            
                </div>
            </nav>
        </header>
    <router-outlet></router-outlet>`
})

export class AppComponent {    
    
}
