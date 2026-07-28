import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";

import { AuthService } from "./core/services/auth.service";
import { CookieConsentService } from "./core/services/cookie-consent.service";
import { ThemeService } from "./core/services/theme.service";
import { CookieBannerComponent } from "./shared/components/cookie-banner/cookie-banner.component";
import { FooterComponent } from "./shared/components/footer/footer.component";
import { HeaderComponent } from "./shared/components/header/header.component";
import { ToastStackComponent } from "./shared/components/toast-stack/toast-stack.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastStackComponent, CookieBannerComponent],
  template: `
    <div class="page-shell" [class.page-shell--home]="isHomeRoute()">
      <app-header [wide]="isHomeRoute()"></app-header>

      <main class="site-main" [class.site-main--home]="isHomeRoute()">
        <router-outlet></router-outlet>
      </main>

      <app-footer [wide]="isHomeRoute()"></app-footer>
      <app-cookie-banner></app-cookie-banner>
      <app-toast-stack></app-toast-stack>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly cookieConsentService = inject(CookieConsentService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly currentUrl = signal(this.router.url);
  readonly isHomeRoute = computed(() => this.isHomeUrl(this.currentUrl()));

  constructor() {
    this.cookieConsentService.init();
    this.themeService.init();
    void this.authService.restoreSession();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });
  }

  private isHomeUrl(url: string): boolean {
    const path = url.split("?")[0]?.split("#")[0] ?? "/";
    return path === "/";
  }
}
