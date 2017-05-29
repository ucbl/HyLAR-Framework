import {APP_BASE_HREF} from '@angular/common';
import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { AppComponent }   from './app.component';
import { HylarComponent }   from './hylar.component';
import { RuleManagerComponent } from './rulemanager.component';
import { FileSelectDirective } from 'ng2-file-upload/ng2-file-upload';
import { KeysPipe } from './pipes';
import { RouterModule, Routes } from '@angular/router';

const appRoutes: Routes = [
    { path: '', component: HylarComponent },
    { path: 'rules', component: RuleManagerComponent }
]

@NgModule({
    imports:      [ BrowserModule, FormsModule, HttpModule, RouterModule.forRoot(appRoutes) ],
    declarations: [ AppComponent, HylarComponent, RuleManagerComponent, FileSelectDirective, KeysPipe ],
    providers: [{provide: APP_BASE_HREF, useValue : './' }],
    bootstrap:    [ AppComponent ]
})

export class AppModule { }