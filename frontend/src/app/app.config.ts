import { provideHttpClient, withFetch, withInterceptors } from "@angular/common/http";
import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from "@angular/core";
import { provideRouter, withInMemoryScrolling } from "@angular/router";

import { apiInterceptor } from "./core/services/api.interceptor";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    {
      provide: LOCALE_ID,
      useValue: "es-CO"
    },
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: "enabled"
      })
    )
  ]
};
