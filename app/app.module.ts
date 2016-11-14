import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent }   from './app.component';
import { HylarComponent }   from './hylar.component';
import { FileSelectDirective } from 'ng2-file-upload/ng2-file-upload';

@NgModule({
    imports:      [ BrowserModule ],
    declarations: [ AppComponent, HylarComponent, FileSelectDirective ],
    bootstrap:    [ AppComponent ]
})

export class AppModule { }
