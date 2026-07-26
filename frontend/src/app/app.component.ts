import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

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
    <div class="page-shell">
      <app-header></app-header>

      <main class="site-main">
        <router-outlet></router-outlet>
      </main>

      <app-footer></app-footer>
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

  constructor() {
    this.cookieConsentService.init();
    this.themeService.init();
    void this.authService.restoreSession();
  }
}
