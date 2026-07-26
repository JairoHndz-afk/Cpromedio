import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { CookieConsentService } from "../../core/services/cookie-consent.service";
import { SeoService } from "../../core/services/seo.service";
import { ThemeService } from "../../core/services/theme.service";

@Component({
  selector: "app-privacy-page",
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <section class="section-block policy-shell">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Privacidad y datos</p>
          <h1>Cómo tratamos cookies, sesiones, boletines y registros editoriales</h1>
          <p class="hero-copy">
            Este texto describe el funcionamiento técnico actual de Colombiano Promedio al 26 de julio de 2026. Debe pasar por revisión legal antes de publicarse como política definitiva.
          </p>
        </div>
        <div class="button-row">
          <a class="button button--ghost" routerLink="/">Volver a portada</a>
        </div>
      </div>

      <section class="policy-card">
        <p class="eyebrow">Resumen operativo</p>
        <div class="policy-list">
          <p>Tratamos datos de navegación técnica para seguridad, inicio de sesión, boletín y moderación editorial.</p>
          <p>No cargamos redes publicitarias ni cookies de terceros para publicidad comportamental.</p>
          <p>La medición de lecturas con cookie propia solo se activa si autorizas esa categoría.</p>
          <p>La preferencia de tema claro/oscuro solo se recuerda si autorizas almacenamiento de preferencias.</p>
        </div>
      </section>

      <div class="policy-grid">
        <section class="policy-card">
          <p class="eyebrow">Datos que sí usamos</p>
          <div class="policy-list">
            <p><strong>Navegación pública:</strong> IP, agente del navegador, idioma, origen y referencia para proteger formularios, limitar abuso y servir el sitio.</p>
            <p><strong>Sesión editorial:</strong> correo, nombre, rol, estado, último acceso y auditoría de acciones dentro del panel.</p>
            <p><strong>Boletín:</strong> nombre, correo, estado de suscripción y tokens temporales de confirmación o salida.</p>
            <p><strong>Moderación y seguridad:</strong> registros de auditoría, intentos de acceso y cambios editoriales asociados a usuarios autenticados.</p>
          </div>
        </section>

        <section class="policy-card">
          <p class="eyebrow">Cookies y almacenamiento</p>
          <div class="policy-list">
            <p><strong><code>periodico_session</code>:</strong> cookie HttpOnly de autenticación editorial. Es esencial y no se expone a JavaScript. Su nombre puede variar por configuración de producción.</p>
            <p><strong><code>cp_cookie_preferences</code>:</strong> guarda tu elección de privacidad por 180 días para no volver a preguntarte lo mismo en cada visita.</p>
            <p><strong><code>cp_recent_views</code>:</strong> cookie propia de medición. Solo se usa si aceptas medición editorial y evita contar varias veces la misma lectura en una ventana aproximada de 45 minutos.</p>
            <p><strong><code>periodico-theme</code>:</strong> almacenamiento local opcional para recordar si prefieres modo claro u oscuro.</p>
          </div>
        </section>

        <section class="policy-card">
          <p class="eyebrow">Finalidades reales</p>
          <div class="policy-list">
            <p>Autenticar administradores y periodistas.</p>
            <p>Proteger formularios y mutaciones contra abuso, origen no permitido y automatización agresiva.</p>
            <p>Enviar y confirmar suscripciones al boletín.</p>
            <p>Medir lecturas de manera propia sin inflar vistas, solo cuando hay consentimiento para ello.</p>
            <p>Conservar trazabilidad editorial y de seguridad dentro del dashboard.</p>
          </div>
        </section>

        <section class="policy-card">
          <p class="eyebrow">Conservación y control</p>
          <div class="policy-list">
            <p>La cookie de sesión expira según la configuración del backend y se elimina al cerrar sesión.</p>
            <p>La preferencia de privacidad permanece por 180 días o hasta que vuelvas a cambiarla.</p>
            <p>Puedes salir del boletín desde el enlace incluido en cada correo.</p>
            <p>Las estadísticas editoriales y registros de auditoría se conservan para operación, seguridad y revisión interna del medio.</p>
          </div>
        </section>
      </div>

      <section class="policy-card">
        <p class="eyebrow">Gestionar mi consentimiento</p>
        <div class="cookie-banner__toggles cookie-banner__toggles--inline">
          <label class="cookie-toggle cookie-toggle--locked">
            <input type="checkbox" [checked]="true" disabled />
            <span>
              <strong>Esenciales</strong>
              <small>Seguridad, sesión, cierre de sesión y preferencia de privacidad.</small>
            </span>
          </label>

          <label class="cookie-toggle">
            <input type="checkbox" [(ngModel)]="preferencesAllowed" name="policyPreferencesAllowed" />
            <span>
              <strong>Preferencias</strong>
              <small>Permite recordar el tema visual del sitio.</small>
            </span>
          </label>

          <label class="cookie-toggle">
            <input type="checkbox" [(ngModel)]="measurementAllowed" name="policyMeasurementAllowed" />
            <span>
              <strong>Medición editorial</strong>
              <small>Permite contar lecturas con cookie propia y sin terceros de publicidad.</small>
            </span>
          </label>
        </div>

        <div class="button-row">
          <button class="button" type="button" (click)="acceptAll()">Aceptar todo</button>
          <button class="button button--secondary" type="button" (click)="saveCustom()">Guardar selección</button>
          <button class="button button--ghost" type="button" (click)="acceptEssentialOnly()">Solo esenciales</button>
        </div>
      </section>

      <section class="policy-card">
        <p class="eyebrow">Referencias oficiales para revisión</p>
        <div class="policy-list">
          <p>Ley 1581 de 2012, régimen general de protección de datos personales en Colombia.</p>
          <p>Decreto 1377 de 2013 y compilación reglamentaria en el Decreto 1074 de 2015.</p>
          <p>Lineamientos y conceptos de la Superintendencia de Industria y Comercio sobre finalidad, aviso de privacidad y tratamiento de datos personales.</p>
          <p>Este aviso cubre boletín, cuentas editoriales, seguridad, auditoría y navegación técnica del sitio; no reemplaza revisión jurídica formal antes de producción.</p>
        </div>
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPageComponent {
  private readonly consent = inject(CookieConsentService);
  private readonly seo = inject(SeoService);
  private readonly themeService = inject(ThemeService);

  preferencesAllowed = this.consent.decision()?.preferences ?? true;
  measurementAllowed = this.consent.decision()?.measurement ?? true;

  constructor() {
    this.seo.setHome({
      title: "Privacidad y cookies | Colombiano Promedio",
      description: "Aviso técnico de privacidad, cookies, boletín, sesiones y manejo de datos en Colombiano Promedio."
    });
  }

  acceptAll(): void {
    this.consent.acceptAll();
    this.themeService.syncPersistence();
    this.preferencesAllowed = true;
    this.measurementAllowed = true;
  }

  acceptEssentialOnly(): void {
    this.consent.acceptEssentialOnly();
    this.themeService.syncPersistence();
    this.preferencesAllowed = false;
    this.measurementAllowed = false;
  }

  saveCustom(): void {
    this.consent.saveCustom({
      preferences: this.preferencesAllowed,
      measurement: this.measurementAllowed
    });
    this.themeService.syncPersistence();
  }
}
