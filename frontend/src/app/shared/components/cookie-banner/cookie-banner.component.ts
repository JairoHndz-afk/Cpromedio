import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { CookieConsentService } from "../../../core/services/cookie-consent.service";
import { ThemeService } from "../../../core/services/theme.service";

@Component({
  selector: "app-cookie-banner",
  standalone: true,
  imports: [NgIf, FormsModule, RouterLink],
  template: `
    <section class="cookie-banner" *ngIf="isVisible()">
      <div class="cookie-banner__content">
        <p class="eyebrow">Privacidad y cookies</p>
        <h2>Usamos solo lo necesario para operar el medio y medir lecturas si tú lo autorizas.</h2>
        <p class="helper-text">
          Este sitio usa una cookie de sesión editorial, una preferencia de privacidad y, si la aceptas, medición propia de lecturas y memoria del tema visual.
        </p>

        <div class="cookie-banner__toggles" *ngIf="showSettings">
          <label class="cookie-toggle cookie-toggle--locked">
            <input type="checkbox" [checked]="true" disabled />
            <span>
              <strong>Esenciales</strong>
              <small>Inicio de sesión, seguridad, cierre de sesión y tu elección de privacidad.</small>
            </span>
          </label>

          <label class="cookie-toggle">
            <input type="checkbox" [(ngModel)]="preferencesAllowed" name="preferencesAllowed" />
            <span>
              <strong>Preferencias</strong>
              <small>Recuerda tu tema claro u oscuro usando almacenamiento local del navegador.</small>
            </span>
          </label>

          <label class="cookie-toggle">
            <input type="checkbox" [(ngModel)]="measurementAllowed" name="measurementAllowed" />
            <span>
              <strong>Medición editorial</strong>
              <small>Permite contar vistas únicas con una cookie propia para no inflar estadísticas.</small>
            </span>
          </label>
        </div>

        <div class="cookie-banner__actions">
          <button class="button" type="button" (click)="acceptAll()">Aceptar todo</button>
          <button class="button button--secondary" type="button" (click)="acceptEssentialOnly()">Solo esenciales</button>
          <button class="button button--ghost" type="button" *ngIf="!showSettings" (click)="openSettings()">Configurar</button>
          <button class="button button--ghost" type="button" *ngIf="showSettings" (click)="saveCustom()">Guardar selección</button>
          <a class="button button--ghost" routerLink="/privacidad">Ver política</a>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookieBannerComponent {
  private readonly consent = inject(CookieConsentService);
  private readonly themeService = inject(ThemeService);

  readonly isVisible = computed(() => !this.consent.hasDecision());
  showSettings = false;
  preferencesAllowed = true;
  measurementAllowed = true;

  openSettings(): void {
    this.showSettings = true;
  }

  acceptAll(): void {
    this.consent.acceptAll();
    this.themeService.syncPersistence();
  }

  acceptEssentialOnly(): void {
    this.consent.acceptEssentialOnly();
    this.themeService.syncPersistence();
  }

  saveCustom(): void {
    this.consent.saveCustom({
      preferences: this.preferencesAllowed,
      measurement: this.measurementAllowed
    });
    this.themeService.syncPersistence();
  }
}
