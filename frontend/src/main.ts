import { registerLocaleData } from "@angular/common";
import localeEsCo from "@angular/common/locales/es-CO";
import { isDevMode } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { inject as injectVercelAnalytics } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

registerLocaleData(localeEsCo);
injectVercelAnalytics({ mode: isDevMode() ? "development" : "production" });
injectSpeedInsights();

bootstrapApplication(AppComponent, appConfig).catch((error) => console.error(error));
