"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var common_1 = require("@angular/common");
var core_1 = require("@angular/core");
var platform_browser_1 = require("@angular/platform-browser");
var forms_1 = require("@angular/forms");
var http_1 = require("@angular/http");
var app_component_1 = require("./app.component");
var hylar_component_1 = require("./hylar.component");
var rulemanager_component_1 = require("./rulemanager.component");
var ng2_file_upload_1 = require("ng2-file-upload/ng2-file-upload");
var pipes_1 = require("./pipes");
var router_1 = require("@angular/router");
var appRoutes = [
    { path: '', component: hylar_component_1.HylarComponent },
    { path: 'rules', component: rulemanager_component_1.RuleManagerComponent }
];
var AppModule = (function () {
    function AppModule() {
    }
    return AppModule;
}());
AppModule = __decorate([
    core_1.NgModule({
        imports: [platform_browser_1.BrowserModule, forms_1.FormsModule, http_1.HttpModule, router_1.RouterModule.forRoot(appRoutes)],
        declarations: [app_component_1.AppComponent, hylar_component_1.HylarComponent, rulemanager_component_1.RuleManagerComponent, ng2_file_upload_1.FileSelectDirective, pipes_1.KeysPipe],
        providers: [{ provide: common_1.APP_BASE_HREF, useValue: './' }],
        bootstrap: [app_component_1.AppComponent]
    })
], AppModule);
exports.AppModule = AppModule;
//# sourceMappingURL=app.module.js.map