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
          <h1>C&oacute;mo tratamos cookies, sesiones, boletines y registros editoriales</h1>
          <p class="hero-copy">
            Este texto describe el funcionamiento t&eacute;cnico actual de Colombiano Promedio al 28 de julio de 2026. Debe pasar por revisi&oacute;n legal antes de publicarse como pol&iacute;tica definitiva.
          </p>
        </div>
        <div class="button-row">
          <a class="button button--ghost" routerLink="/">Volver a portada</a>
        </div>
      </div>

      <section class="policy-card">
        <p class="eyebrow">Resumen operativo</p>
        <div class="policy-list">
          <p>Tratamos datos de navegaci&oacute;n t&eacute;cnica para seguridad, inicio de sesi&oacute;n, bolet&iacute;n y moderaci&oacute;n editorial.</p>
          <p>No cargamos redes publicitarias ni cookies de terceros para publicidad comportamental.</p>
          <p>La medici&oacute;n de lecturas con cookie propia solo se activa si autorizas esa categor&iacute;a.</p>
          <p>La preferencia de tema claro u oscuro solo se recuerda si autorizas almacenamiento de preferencias.</p>
          <p>Los comunicados editoriales pueden recordar si ya cerraste una ventana activa usando una cookie esencial renovable por versi&oacute;n.</p>
        </div>
      </section>

      <div class="policy-grid">
        <section class="policy-card">
          <p class="eyebrow">Datos que s&iacute; usamos</p>
          <div class="policy-list">
            <p><strong>Navegaci&oacute;n p&uacute;blica:</strong> IP, agente del navegador, idioma, origen y referencia para proteger formularios, limitar abuso y servir el sitio.</p>
            <p><strong>Sesi&oacute;n editorial:</strong> correo, nombre, rol, estado, &uacute;ltimo acceso y auditor&iacute;a de acciones dentro del panel.</p>
            <p><strong>Bolet&iacute;n:</strong> nombre, correo, estado de suscripci&oacute;n y tokens temporales de confirmaci&oacute;n o salida.</p>
            <p><strong>Moderaci&oacute;n y seguridad:</strong> registros de auditor&iacute;a, intentos de acceso y cambios editoriales asociados a usuarios autenticados.</p>
          </div>
        </section>

        <section class="policy-card">
          <p class="eyebrow">Cookies y almacenamiento</p>
          <div class="policy-list">
            <p><strong><code>periodico_session</code>:</strong> cookie HttpOnly de autenticaci&oacute;n editorial. Es esencial y no se expone a JavaScript. Su nombre puede variar por configuraci&oacute;n de producci&oacute;n.</p>
            <p><strong><code>cp_cookie_preferences</code>:</strong> guarda tu elecci&oacute;n de privacidad por 180 d&iacute;as para no volver a preguntarte lo mismo en cada visita.</p>
            <p><strong><code>cp_recent_views</code>:</strong> cookie propia de medici&oacute;n. Solo se usa si aceptas medici&oacute;n editorial y evita contar varias veces la misma lectura en una ventana aproximada de 45 minutos.</p>
            <p><strong><code>cp_editorial_notice</code>:</strong> cookie esencial que recuerda si ya cerraste un comunicado editorial activo. Solo vuelve a mostrarse si la redacci&oacute;n publica una nueva versi&oacute;n o renueva la comunicaci&oacute;n.</p>
            <p><strong><code>periodico-theme</code>:</strong> almacenamiento local opcional para recordar si prefieres modo claro u oscuro.</p>
          </div>
        </section>

        <section class="policy-card">
          <p class="eyebrow">Finalidades reales</p>
          <div class="policy-list">
            <p>Autenticar administradores y periodistas.</p>
            <p>Proteger formularios y mutaciones contra abuso, origen no permitido y automatizaci&oacute;n agresiva.</p>
            <p>Enviar y confirmar suscripciones al bolet&iacute;n.</p>
            <p>Medir lecturas de manera propia sin inflar vistas, solo cuando hay consentimiento para ello.</p>
            <p>Mostrar comunicaciones editoriales temporales y recordar si ya fueron cerradas por el lector.</p>
            <p>Conservar trazabilidad editorial y de seguridad dentro del dashboard.</p>
          </div>
        </section>

        <section class="policy-card">
          <p class="eyebrow">Conservaci&oacute;n y control</p>
          <div class="policy-list">
            <p>La cookie de sesi&oacute;n expira seg&uacute;n la configuraci&oacute;n del backend y se elimina al cerrar sesi&oacute;n.</p>
            <p>La preferencia de privacidad permanece por 180 d&iacute;as o hasta que vuelvas a cambiarla.</p>
            <p>La memoria del comunicado editorial dura hasta que expire la pieza activa o sea reemplazada por una nueva versi&oacute;n.</p>
            <p>Puedes salir del bolet&iacute;n desde el enlace incluido en cada correo.</p>
            <p>Las estad&iacute;sticas editoriales y registros de auditor&iacute;a se conservan para operaci&oacute;n, seguridad y revisi&oacute;n interna del medio.</p>
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
              <small>Seguridad, sesi&oacute;n, cierre de sesi&oacute;n, preferencia de privacidad y memoria de comunicados editoriales.</small>
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
              <strong>Medici&oacute;n editorial</strong>
              <small>Permite contar lecturas con cookie propia y sin terceros de publicidad.</small>
            </span>
          </label>
        </div>

        <div class="button-row">
          <button class="button" type="button" (click)="acceptAll()">Aceptar todo</button>
          <button class="button button--secondary" type="button" (click)="saveCustom()">Guardar selecci&oacute;n</button>
          <button class="button button--ghost" type="button" (click)="acceptEssentialOnly()">Solo esenciales</button>
        </div>
      </section>

      <section class="policy-card">
        <p class="eyebrow">Referencias oficiales para revisi&oacute;n</p>
        <div class="policy-list">
          <p>Ley 1581 de 2012, r&eacute;gimen general de protecci&oacute;n de datos personales en Colombia.</p>
          <p>Decreto 1377 de 2013 y compilaci&oacute;n reglamentaria en el Decreto 1074 de 2015.</p>
          <p>Lineamientos y conceptos de la Superintendencia de Industria y Comercio sobre finalidad, aviso de privacidad y tratamiento de datos personales.</p>
          <p>Este aviso cubre bolet&iacute;n, cuentas editoriales, seguridad, auditor&iacute;a, navegaci&oacute;n t&eacute;cnica y comunicados temporales del sitio; no reemplaza revisi&oacute;n jur&iacute;dica formal antes de producci&oacute;n.</p>
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
      description: "Aviso técnico de privacidad, cookies, boletín, sesiones, comunicados temporales y manejo de datos en Colombiano Promedio."
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
