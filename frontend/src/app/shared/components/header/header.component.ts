import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, inject, input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { filter } from "rxjs";

import { AuthService } from "../../../core/services/auth.service";
import { ThemeService } from "../../../core/services/theme.service";
import { BrandMarkComponent } from "../brand-mark/brand-mark.component";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIf, BrandMarkComponent, FormsModule],
  template: `
    <header class="site-header" [class.site-header--wide]="wide()">
      <div class="site-header__inner" [class.site-header__inner--wide]="wide()">
        <a class="brand" routerLink="/" aria-label="Colombiano Promedio">
          <app-brand-mark class="brand__mark" aria-hidden="true"></app-brand-mark>
          <span class="brand__copy">
            <strong>Colombiano Promedio</strong>
            <small>Hasta que la dignidad se haga costumbre</small>
          </span>
        </a>

        <nav class="site-nav" aria-label="Principal" [class.site-nav--open]="menuOpen && isCompactViewport">
          <button
            *ngIf="isCompactViewport"
            class="site-nav-toggle"
            type="button"
            [attr.aria-label]="menuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'"
            aria-controls="site-nav-panel"
            [attr.aria-expanded]="menuOpen"
            (click)="toggleMenu()"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div class="site-nav__panel" id="site-nav-panel" *ngIf="!isCompactViewport || menuOpen">
            <form class="site-nav__search" *ngIf="isCompactViewport" (ngSubmit)="submitSearch()">
              <input
                type="text"
                [(ngModel)]="searchTerm"
                name="navSearchTerm"
                placeholder="Buscar art&iacute;culos"
                aria-label="Buscar art&iacute;culos"
              />
              <button class="button button--secondary" type="submit">Buscar</button>
            </form>

            <div class="site-nav__links">
              <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">Inicio</a>
              <a routerLink="/privacidad" routerLinkActive="is-active" (click)="closeMenu()">Privacidad</a>
              <a routerLink="/login" routerLinkActive="is-active" *ngIf="!authService.isAuthenticated()" (click)="closeMenu()">Acceso</a>
              <a routerLink="/dashboard" routerLinkActive="is-active" *ngIf="authService.isAuthenticated()" (click)="closeMenu()">Panel</a>
            </div>
            <div class="site-nav__actions">
              <button
                class="theme-toggle theme-toggle--icon"
                type="button"
                [attr.aria-label]="themeService.mode() === 'dark' ? 'Tema oscuro activado. Cambiar a claro' : 'Tema claro activado. Cambiar a oscuro'"
                [attr.title]="themeService.mode() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                (click)="toggleTheme()"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="themeService.mode() !== 'dark'; else sunIcon">
                  <path
                    d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 1 0 9.8 9.8Z"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                </svg>
                <ng-template #sunIcon>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle
                      cx="12"
                      cy="12"
                      r="4.2"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                    />
                    <path
                      d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.8"
                    />
                  </svg>
                </ng-template>
              </button>
              <button class="nav-button" type="button" *ngIf="authService.isAuthenticated()" (click)="logout()">
                Salir
              </button>
            </div>
          </div>
        </nav>
      </div>

      <button
        class="site-nav-backdrop"
        type="button"
        *ngIf="isCompactViewport && menuOpen"
        aria-label="Cerrar menú"
        (click)="closeMenu()"
      ></button>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly wide = input(false);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  searchTerm = "";
  menuOpen = false;
  isCompactViewport = typeof window !== "undefined" ? window.innerWidth <= 960 : false;

  constructor() {
    this.syncSearchTermFromUrl(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.syncSearchTermFromUrl(event.urlAfterRedirects);
      });
  }

  @HostListener("window:keydown.escape")
  onEscape(): void {
    this.closeMenu();
  }

  @HostListener("window:resize")
  onResize(): void {
    const nextCompactViewport = window.innerWidth <= 960;

    if (this.isCompactViewport !== nextCompactViewport) {
      this.isCompactViewport = nextCompactViewport;
    }

    if (!this.isCompactViewport && this.menuOpen) {
      this.closeMenu();
    }
  }

  toggleMenu(): void {
    if (!this.isCompactViewport) {
      return;
    }

    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  submitSearch(): void {
    const query = this.searchTerm.trim();
    this.closeMenu();
    void this.router.navigate(["/"], {
      queryParams: {
        search: query || null,
        tag: null,
        category: null
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggle();
    this.closeMenu();
  }

  async logout(): Promise<void> {
    this.closeMenu();
    await this.authService.logout();
    await this.router.navigateByUrl("/");
  }

  private syncSearchTermFromUrl(url: string): void {
    const query = this.router.parseUrl(url).queryParams["search"];
    this.searchTerm = typeof query === "string" ? query : "";
  }
}
