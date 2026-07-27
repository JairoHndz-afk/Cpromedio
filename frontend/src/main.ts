import { registerLocaleData } from "@angular/common";
import localeEsCo from "@angular/common/locales/es-CO";
import { isDevMode } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { inject as injectVercelAnalytics } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

const PRODUCTION_HOSTS = new Set(["colombianopromedio.co", "www.colombianopromedio.co"]);
const EXCLUDED_INSIGHTS_PATHS = ["/dashboard", "/login", "/boletin"];

function shouldTrackSpeedInsights(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);

    if (!PRODUCTION_HOSTS.has(hostname)) {
      return false;
    }

    return !EXCLUDED_INSIGHTS_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}

registerLocaleData(localeEsCo);
injectVercelAnalytics({ mode: isDevMode() ? "development" : "production" });
injectSpeedInsights({
  sampleRate: 0.5,
  beforeSend: (payload) => (shouldTrackSpeedInsights(payload.url) ? payload : null)
});

bootstrapApplication(AppComponent, appConfig).catch((error) => console.error(error));
