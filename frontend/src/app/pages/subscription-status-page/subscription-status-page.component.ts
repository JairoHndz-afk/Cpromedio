import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";

type SubscriptionAction = "confirmar" | "reactivar" | "salir";
type SubscriptionState = "idle" | "processing" | "success" | "error";

@Component({
  selector: "app-subscription-status-page",
  standalone: true,
  imports: [NgIf, RouterLink],
  template: `
    <section class="subscription-status-shell">
      <article
        class="subscription-status-card"
        [class.subscription-status-card--success]="state === 'success'"
        [class.subscription-status-card--error]="state === 'error'"
      >
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="hero-copy">{{ message }}</p>

        <div class="tag-row">
          <span class="meta-pill meta-pill--author">{{ stateLabel }}</span>
          <span class="meta-pill meta-pill--soft">Enlace seguro</span>
        </div>

        <div class="button-row">
          <a class="button button--ghost" routerLink="/">{{ homeLabel }}</a>
          <button class="button" type="button" *ngIf="showConfirmExit" (click)="confirmUnsubscribe()">Confirmar salida</button>
          <button class="button" type="button" *ngIf="showRetry" (click)="retry()">Reintentar</button>
        </div>
      </article>

      <aside class="subscription-status-note">
        <p class="eyebrow">Estado editorial</p>
        <h2>{{ sideTitle }}</h2>
        <p class="helper-text">{{ sideMessage }}</p>

        <div class="subscription-status-steps">
          <div class="feature-note">
            <p class="eyebrow">1. Validación</p>
            <h3>El enlace se revisa antes de activar cambios reales.</h3>
          </div>
          <div class="feature-note">
            <p class="eyebrow">2. Confirmación</p>
            <h3>La salida del boletín solo se completa si el lector la aprueba.</h3>
          </div>
        </div>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionStatusPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicApi = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  private action: SubscriptionAction | null = null;
  private token = "";

  state: SubscriptionState = "processing";
  eyebrow = "Boletín";
  title = "Procesando solicitud";
  message = "Validando tu solicitud editorial.";
  showRetry = false;
  showConfirmExit = false;

  constructor() {
    this.seo.setNoIndex("Estado del boletín | Colombiano Promedio", "Pantalla transaccional para confirmar, reactivar o cancelar una suscripción.");

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.prepare();
    });
  }

  get stateLabel(): string {
    if (this.state === "success") {
      return "Proceso completado";
    }

    if (this.state === "error") {
      return "Acción pendiente";
    }

    if (this.state === "idle") {
      return "Confirmación requerida";
    }

    return "Protección activa";
  }

  get sideTitle(): string {
    if (this.state === "success") {
      return this.action === "salir"
        ? "La baja quedó lista y el boletín dejó de usar este correo."
        : "Tu correo ya quedó dentro del circuito editorial.";
    }

    if (this.state === "error") {
      return "El enlace sigue protegido y puedes intentarlo de nuevo.";
    }

    if (this.state === "idle") {
      return "Todavía no se hizo ningún cambio sobre tu suscripción.";
    }

    return "Estamos verificando el enlace antes de activar cambios.";
  }

  get sideMessage(): string {
    if (this.state === "success") {
      return this.action === "salir"
        ? "También deberías recibir un correo de despedida con una opción para volver cuando quieras."
        : "A partir de ahora el boletín puede avisarte de nuevas publicaciones sin obligarte a registrarte otra vez.";
    }

    if (this.state === "error") {
      return "Si vuelve a fallar, revisa si el enlace venció o solicita una nueva suscripción desde la portada.";
    }

    if (this.state === "idle") {
      return "Solo cuando confirmes la salida cancelaremos el boletín y emitiremos el correo de despedida.";
    }

    return "Este paso evita cambios accidentales y mantiene limpia la lista de lectores del boletín.";
  }

  get homeLabel(): string {
    return this.state === "idle" && this.action === "salir" ? "Conservar suscripción" : "Volver a portada";
  }

  private readError(error: unknown, fallback: string): string {
    if (error && typeof error === "object") {
      const payload = (error as { error?: { message?: string; details?: string[] } }).error;

      if (Array.isArray(payload?.details) && payload.details.length > 0) {
        return payload.details.join(" ");
      }

      if (typeof payload?.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    }

    return fallback;
  }

  async prepare(): Promise<void> {
    const action = (this.route.snapshot.paramMap.get("action") ?? "") as SubscriptionAction;
    const token = this.route.snapshot.queryParamMap.get("token") ?? "";

    this.action = action;
    this.token = token;
    this.showRetry = false;
    this.showConfirmExit = false;

    if (!token) {
      this.state = "error";
      this.eyebrow = "Boletín";
      this.title = "Enlace incompleto";
      this.message = "El enlace recibido no incluye un token válido.";
      this.cdr.markForCheck();
      return;
    }

    if (action !== "confirmar" && action !== "reactivar" && action !== "salir") {
      this.state = "error";
      this.eyebrow = "Boletín";
      this.title = "Acción no disponible";
      this.message = "La acción solicitada no existe.";
      this.cdr.markForCheck();
      return;
    }

    if (action === "salir") {
      this.state = "idle";
      this.eyebrow = "Confirmación";
      this.title = "¿Quieres cancelar tu suscripción?";
      this.message = "Todavía no cancelamos nada. Revisa la solicitud y confirma la salida solo si realmente quieres dejar el boletín.";
      this.showConfirmExit = true;
      this.cdr.markForCheck();
      return;
    }

    await this.executeAction();
  }

  async retry(): Promise<void> {
    if (this.action === "salir") {
      this.showConfirmExit = true;
    }

    await this.executeAction();
  }

  async confirmUnsubscribe(): Promise<void> {
    await this.executeAction(true);
  }

  private async executeAction(forceUnsubscribe = false): Promise<void> {
    if (!this.action || !this.token) {
      return;
    }

    if (this.action === "salir" && !forceUnsubscribe) {
      return;
    }

    this.state = "processing";
    this.showRetry = false;
    this.showConfirmExit = false;

    if (this.action === "confirmar") {
      this.eyebrow = "Confirmación";
      this.title = "Confirmando tu correo";
      this.message = "Estamos activando tu boletín editorial.";
    } else if (this.action === "reactivar") {
      this.eyebrow = "Reactivación";
      this.title = "Recuperando tu suscripción";
      this.message = "Estamos devolviendo este correo al boletín editorial.";
    } else {
      this.eyebrow = "Suscripción";
      this.title = "Cancelando tu suscripción";
      this.message = "Estamos procesando la salida del boletín.";
    }

    this.cdr.markForCheck();

    try {
      const response =
        this.action === "confirmar"
          ? await this.publicApi.confirmSubscription(this.token)
          : this.action === "reactivar"
            ? await this.publicApi.reactivateSubscription(this.token)
            : await this.publicApi.unsubscribeSubscription(this.token);

      this.state = "success";
      this.eyebrow =
        this.action === "confirmar"
          ? "Suscripción activa"
          : this.action === "reactivar"
            ? "Suscripción recuperada"
            : "Suscripción cancelada";
      this.title =
        this.action === "confirmar"
          ? "Todo listo"
          : this.action === "reactivar"
            ? "Boletín reactivado"
            : "Salida completada";
      this.message = response.message;
    } catch (error) {
      this.state = "error";
      this.eyebrow = this.action === "reactivar" ? "Reactivación" : this.action === "confirmar" ? "Confirmación" : "Suscripción";
      this.title =
        this.action === "confirmar"
          ? "No fue posible confirmar"
          : this.action === "reactivar"
            ? "No fue posible reactivar"
            : "No fue posible cancelar";
      this.message = this.readError(
        error,
        this.action === "confirmar"
          ? "No pudimos activar tu suscripción en este momento."
          : this.action === "reactivar"
            ? "No pudimos reactivar tu suscripción en este momento."
            : "No pudimos cancelar tu suscripción en este momento."
      );
      this.showRetry = true;
      this.showConfirmExit = this.action === "salir";
    } finally {
      this.cdr.markForCheck();
    }
  }
}
