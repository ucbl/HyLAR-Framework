import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { AppComponent }   from './app.component';
import { HylarComponent }   from './hylar.component';
import { FileSelectDirective } from 'ng2-file-upload/ng2-file-upload';

@NgModule({
    imports:      [ BrowserModule, FormsModule, HttpModule ],
    declarations: [ AppComponent, HylarComponent, FileSelectDirective ],
    bootstrap:    [ AppComponent ]
})

export class AppModule { }