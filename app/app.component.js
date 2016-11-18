"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require('@angular/core');
core_1.enableProdMode();
var AppComponent = (function () {
    function AppComponent() {
    }
    AppComponent = __decorate([
        core_1.Component({
            selector: 'my-app',
            template: "\n        <header>\n            <nav class=\"navbar navbar-default navbar-fixed-right\" role=\"navigation\">\n                <div class=\"container-fluid\">\n                    <div class=\"navbar-header\">\n                        <a href=\"/\" class=\"navbar-brand\">\n                            <img style=\"float: left; max-width:100%; max-height:100%;\" src=\"favicon.ico\"/>\n                            &nbsp;\n                            HyLAR-Framework\n                        </a>\n                        <a href=\"/rules\" target=\"_blank\" onclick=\"window.open(this.href, 'mywin','left=20,top=20,width=50%,resizable=0'); return false;\" class=\"navbar-brand\">                            \n                            &nbsp;\n                            Rules\n                        </a>\n                    </div>            \n                </div>\n            </nav>\n        </header>\n    <router-outlet></router-outlet>"
        }), 
        __metadata('design:paramtypes', [])
    ], AppComponent);
    return AppComponent;
}());
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map