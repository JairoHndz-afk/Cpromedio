import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";

import { AuthService } from "./core/services/auth.service";
import { CookieConsentService } from "./core/services/cookie-consent.service";
import { CommunicationNoticeService } from "./core/services/communication-notice.service";
import { PublicApiService } from "./core/services/public-api.service";
import { ThemeService } from "./core/services/theme.service";
import { SiteCommunication } from "./core/types/api.types";
import { CommunicationModalComponent } from "./shared/components/communication-modal/communication-modal.component";
import { CookieBannerComponent } from "./shared/components/cookie-banner/cookie-banner.component";
import { FooterComponent } from "./shared/components/footer/footer.component";
import { HeaderComponent } from "./shared/components/header/header.component";
import { ToastStackComponent } from "./shared/components/toast-stack/toast-stack.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastStackComponent, CookieBannerComponent, CommunicationModalComponent],
  template: `
    <div class="page-shell" [class.page-shell--home]="isHomeRoute()">
      <app-header [wide]="isHomeRoute()"></app-header>

      <main class="site-main" [class.site-main--home]="isHomeRoute()">
        <router-outlet></router-outlet>
      </main>

      <app-footer [wide]="isHomeRoute()"></app-footer>
      <app-communication-modal
        [communication]="siteCommunication()"
        [visible]="communicationVisible()"
        (dismiss)="dismissCommunication()"
        (cta)="dismissCommunication()"
      ></app-communication-modal>
      <app-cookie-banner></app-cookie-banner>
      <app-toast-stack></app-toast-stack>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly cookieConsentService = inject(CookieConsentService);
  private readonly communicationNotice = inject(CommunicationNoticeService);
  private readonly publicApi = inject(PublicApiService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly currentUrl = signal(this.router.url);
  readonly isHomeRoute = computed(() => this.isHomeUrl(this.currentUrl()));
  readonly siteCommunication = signal<SiteCommunication | null>(null);
  readonly communicationVisible = signal(false);
  private readonly communicationLoaded = signal(false);

  constructor() {
    this.cookieConsentService.init();
    this.themeService.init();
    void this.authService.restoreSession();
    void this.loadSiteCommunication();

    effect(() => {
      const isLoaded = this.communicationLoaded();
      const hasCookieDecision = this.cookieConsentService.hasDecision();
      const currentUrl = this.currentUrl();
      const communication = this.siteCommunication();

      if (!isLoaded || !hasCookieDecision) {
        this.communicationVisible.set(false);
        return;
      }

      const visible = this.isCommunicationEligibleUrl(currentUrl) && this.communicationNotice.shouldShow(communication);
      this.communicationVisible.set(visible);
    });

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

  private isCommunicationEligibleUrl(url: string): boolean {
    const path = url.split("?")[0]?.split("#")[0] ?? "/";

    return !["/dashboard", "/login", "/privacidad", "/boletin", "/cuenta", "/lectores", "/registro"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
  }

  private async loadSiteCommunication(): Promise<void> {
    try {
      const response = await this.publicApi.getCommunication();
      this.siteCommunication.set(response.communication);
    } catch {
      this.siteCommunication.set(null);
    } finally {
      this.communicationLoaded.set(true);
    }
  }

  dismissCommunication(): void {
    const communication = this.siteCommunication();

    if (communication) {
      this.communicationNotice.dismiss(communication);
    }

    this.communicationVisible.set(false);
  }
}
