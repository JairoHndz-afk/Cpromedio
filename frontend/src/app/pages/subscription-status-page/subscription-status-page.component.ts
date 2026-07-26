import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";

type SubscriptionAction = "confirmar" | "salir";
type SubscriptionState = "processing" | "success" | "error";

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
          <a class="button" routerLink="/">Volver a portada</a>
          <button class="button button--ghost" type="button" *ngIf="showRetry" (click)="process()">Reintentar</button>
        </div>
      </article>

      <aside class="subscription-status-note">
        <p class="eyebrow">Estado editorial</p>
        <h2>{{ sideTitle }}</h2>
        <p class="helper-text">{{ sideMessage }}</p>

        <div class="subscription-status-steps">
          <div class="feature-note">
            <p class="eyebrow">1. Validacion</p>
            <h3>El enlace se revisa antes de activar cambios.</h3>
          </div>
          <div class="feature-note">
            <p class="eyebrow">2. Confirmacion</p>
            <h3>Solo el lector con el token puede completar la accion.</h3>
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
  private readonly cdr = inject(ChangeDetectorRef);

  state: SubscriptionState = "processing";
  eyebrow = "Boletin";
  title = "Procesando solicitud";
  message = "Validando tu solicitud editorial.";
  showRetry = false;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.process();
    });
  }

  get stateLabel(): string {
    if (this.state === "success") {
      return "Proceso completado";
    }

    if (this.state === "error") {
      return "Accion pendiente";
    }

    return "Proteccion activa";
  }

  get sideTitle(): string {
    if (this.state === "success") {
      return "Tu correo ya quedo dentro del circuito editorial.";
    }

    if (this.state === "error") {
      return "El enlace sigue protegido y puedes intentarlo de nuevo.";
    }

    return "Estamos verificando el enlace antes de activar cambios.";
  }

  get sideMessage(): string {
    if (this.state === "success") {
      return "A partir de ahora el boletin puede avisarte de nuevas publicaciones sin obligarte a registrarte otra vez.";
    }

    if (this.state === "error") {
      return "Si vuelve a fallar, revisa si el enlace vencio o solicita una nueva suscripcion desde la portada.";
    }

    return "Este paso evita altas falsas y mantiene limpia la lista de lectores del boletin.";
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

  async process(): Promise<void> {
    const action = (this.route.snapshot.paramMap.get("action") ?? "") as SubscriptionAction;
    const token = this.route.snapshot.queryParamMap.get("token") ?? "";

    this.state = "processing";
    this.showRetry = false;

    if (!token) {
      this.eyebrow = "Boletin";
      this.title = "Enlace incompleto";
      this.message = "El enlace recibido no incluye un token valido.";
      this.state = "error";
      this.cdr.markForCheck();
      return;
    }

    if (action !== "confirmar" && action !== "salir") {
      this.eyebrow = "Boletin";
      this.title = "Accion no disponible";
      this.message = "La accion solicitada no existe.";
      this.state = "error";
      this.cdr.markForCheck();
      return;
    }

    this.eyebrow = action === "confirmar" ? "Confirmacion" : "Suscripcion";
    this.title = action === "confirmar" ? "Confirmando tu correo" : "Cancelando tu suscripcion";
    this.message = action === "confirmar" ? "Estamos activando tu boletin editorial." : "Estamos procesando la salida del boletin.";
    this.cdr.markForCheck();

    try {
      const response =
        action === "confirmar"
          ? await this.publicApi.confirmSubscription(token)
          : await this.publicApi.unsubscribeSubscription(token);

      this.state = "success";
      this.eyebrow = action === "confirmar" ? "Suscripcion activa" : "Suscripcion cancelada";
      this.title = action === "confirmar" ? "Todo listo" : "Salida completada";
      this.message = response.message;
    } catch (error) {
      this.state = "error";
      this.eyebrow = action === "confirmar" ? "Confirmacion" : "Suscripcion";
      this.title = action === "confirmar" ? "No fue posible confirmar" : "No fue posible cancelar";
      this.message = this.readError(
        error,
        action === "confirmar"
          ? "No pudimos activar tu suscripcion en este momento."
          : "No pudimos cancelar tu suscripcion en este momento."
      );
      this.showRetry = true;
    } finally {
      this.cdr.markForCheck();
    }
  }
}
