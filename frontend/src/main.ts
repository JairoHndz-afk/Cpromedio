import { registerLocaleData } from "@angular/common";
import localeEsCo from "@angular/common/locales/es-CO";
import { bootstrapApplication } from "@angular/platform-browser";

import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

registerLocaleData(localeEsCo);

bootstrapApplication(AppComponent, appConfig).catch((error) => console.error(error));
