import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AuthService } from "../../core/services/auth.service";
import { PublicApiService } from "../../core/services/public-api.service";
import { ReaderApiService } from "../../core/services/reader-api.service";
import { SeoService } from "../../core/services/seo.service";
import { ReaderSubscriptionAccessPayload } from "../../core/types/api.types";
import { PASSWORD_REQUIREMENTS_MESSAGE, passwordMeetsPolicy } from "../../core/utils/password-policy";

type ReaderManagePasswordField = "password" | "confirm";

@Component({
  selector: "app-reader-subscription-manage-page",
  standalone: true,
  imports: [NgIf, RouterLink, FormsModule],
  template: `
    <section class="subscription-status-shell">
      <article
        class="subscription-status-card"
        [class.subscription-status-card--success]="state === 'success'"
        [class.subscription-status-card--error]="state === 'error'"
      >
        <p class="eyebrow">Gestión de cuenta</p>
        <h1>{{ title }}</h1>
        <p class="hero-copy">{{ message }}</p>

        <div class="tag-row" *ngIf="access?.subscription as subscription">
          <span class="meta-pill meta-pill--author">{{ subscription.plan === "premium" ? "Premium" : "Boletín" }}</span>
          <span class="meta-pill meta-pill--soft">{{ subscription.email }}</span>
          <span class="meta-pill meta-pill--warm">{{ subscriptionStatusLabel(subscription.status) }}</span>
        </div>

        <div class="subscription-manage-card" *ngIf="access?.subscription && state !== 'error'">
          <div *ngIf="!access?.readerAccount?.exists; else existingReaderAccess">
            <p class="helper-text">
              Crea una clave para activar tu cuenta. Podrás comentar, editar tus aportes y administrar tu foto de perfil.
            </p>

            <form class="reader-register-form" (ngSubmit)="createReaderAccount()">
              <label>
                <span>Nombre visible</span>
                <input type="text" [(ngModel)]="accessForm.name" name="readerAccessName" [disabled]="creatingAccount" required />
              </label>

              <label>
                <span>Contraseña</span>
                <div class="password-field">
                  <input
                    [type]="passwordVisibility.password ? 'text' : 'password'"
                    [(ngModel)]="accessForm.password"
                    name="readerAccessPassword"
                    autocomplete="new-password"
                    [disabled]="creatingAccount"
                    required
                  />
                  <button
                    class="password-toggle"
                    [class.is-active]="passwordVisibility.password"
                    type="button"
                    [attr.aria-label]="passwordVisibility.password ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    [attr.aria-pressed]="passwordVisibility.password"
                    (click)="togglePassword('password')"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" *ngIf="!passwordVisibility.password" />
                      <circle cx="12" cy="12" r="3.2" *ngIf="!passwordVisibility.password" />
                      <g *ngIf="passwordVisibility.password">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                        <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                        <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                      </g>
                    </svg>
                  </button>
                </div>
                <p class="helper-text">{{ passwordRequirementsMessage }}</p>
              </label>

              <label>
                <span>Confirmar contraseña</span>
                <div class="password-field">
                  <input
                    [type]="passwordVisibility.confirm ? 'text' : 'password'"
                    [(ngModel)]="accessForm.confirmPassword"
                    name="readerAccessConfirmPassword"
                    autocomplete="new-password"
                    [disabled]="creatingAccount"
                    required
                  />
                  <button
                    class="password-toggle"
                    [class.is-active]="passwordVisibility.confirm"
                    type="button"
                    [attr.aria-label]="passwordVisibility.confirm ? 'Ocultar confirmación' : 'Mostrar confirmación'"
                    [attr.aria-pressed]="passwordVisibility.confirm"
                    (click)="togglePassword('confirm')"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" *ngIf="!passwordVisibility.confirm" />
                      <circle cx="12" cy="12" r="3.2" *ngIf="!passwordVisibility.confirm" />
                      <g *ngIf="passwordVisibility.confirm">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                        <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                        <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                      </g>
                    </svg>
                  </button>
                </div>
              </label>

              <div class="button-row">
                <button class="button" type="submit" [disabled]="creatingAccount">
                  {{ creatingAccount ? "Creando cuenta..." : "Crear cuenta" }}
                </button>
              </div>
            </form>
          </div>

          <ng-template #existingReaderAccess>
            <p class="helper-text">
              Este correo ya tiene una cuenta asociada. Si todavía no has iniciado sesión en este navegador, puedes entrar desde el acceso general del sitio.
            </p>
            <div class="button-row">
              <a class="button" *ngIf="authService.isReader(); else loginReaderAccess" routerLink="/cuenta">Abrir mi cuenta</a>
              <ng-template #loginReaderAccess>
                <a class="button" [routerLink]="['/login']" [queryParams]="loginQueryParams">Iniciar sesión</a>
              </ng-template>
            </div>
          </ng-template>

          <div class="button-row">
            <button
              class="button button--ghost"
              type="button"
              *ngIf="access?.subscription?.status === 'active'"
              [disabled]="cancellingSubscription"
              (click)="cancelSubscription()"
            >
              {{ cancellingSubscription ? "Cancelando..." : "Cancelar suscripción" }}
            </button>
          </div>

          <p class="helper-text" *ngIf="statusMessage">{{ statusMessage }}</p>
          <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
        </div>

        <div class="button-row">
          <a class="button button--ghost" routerLink="/">Volver a portada</a>
        </div>
      </article>

      <aside class="subscription-status-note">
        <p class="eyebrow">Flujo de cuenta</p>
        <h2>Un mismo correo para recibir publicaciones y activar tu acceso de comentarios.</h2>
        <p class="helper-text">
          Tu cuenta no cambia tu plan del boletín. Solo abre la puerta para comentar, editar tus aportes y administrar tu perfil dentro del sitio.
        </p>

        <div class="subscription-status-steps">
          <div class="feature-note">
            <p class="eyebrow">1. Suscripción</p>
            <h3>El boletín sigue activo y este enlace prueba que controlas el correo.</h3>
          </div>
          <div class="feature-note">
            <p class="eyebrow">2. Cuenta</p>
            <h3>Al crear la clave quedas listo para comentar y gestionar tus publicaciones.</h3>
          </div>
        </div>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReaderSubscriptionManagePageComponent {
  readonly authService = inject(AuthService);
  private readonly readerApi = inject(ReaderApiService);
  private readonly publicApi = inject(PublicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  state: "loading" | "ready" | "success" | "error" = "loading";
  title = "Validando enlace";
  message = "Estamos revisando la gestión de este correo.";
  statusMessage = "";
  errorMessage = "";
  creatingAccount = false;
  cancellingSubscription = false;
  readonly passwordRequirementsMessage = PASSWORD_REQUIREMENTS_MESSAGE;
  access: ReaderSubscriptionAccessPayload | null = null;
  accessForm = {
    name: "",
    password: "",
    confirmPassword: ""
  };
  passwordVisibility: Record<ReaderManagePasswordField, boolean> = {
    password: false,
    confirm: false
  };

  constructor() {
    this.seo.setNoIndex(
      "Gestión de suscripción y cuenta | Colombiano Promedio",
      "Pantalla privada para administrar la suscripción y crear tu cuenta."
    );
    void this.loadAccess();
  }

  get loginQueryParams(): Record<string, string> {
    return {
      redirect: "/cuenta"
    };
  }

  togglePassword(field: ReaderManagePasswordField): void {
    this.passwordVisibility[field] = !this.passwordVisibility[field];
  }

  subscriptionStatusLabel(status: NonNullable<ReaderSubscriptionAccessPayload["subscription"]>["status"]): string {
    if (status === "active") {
      return "Suscripción activa";
    }

    if (status === "paused") {
      return "Suscripción en pausa";
    }

    if (status === "cancelled") {
      return "Suscripción cancelada";
    }

    return "Confirmación pendiente";
  }

  async createReaderAccount(): Promise<void> {
    const token = this.token();

    if (!token) {
      return;
    }

    this.errorMessage = "";
    this.statusMessage = "";

    const validationMessage = this.validateAccessForm();

    if (validationMessage) {
      this.errorMessage = validationMessage;
      return;
    }

    this.creatingAccount = true;

    try {
      const response = await this.readerApi.createFromSubscriptionAccess({
        token,
        name: this.accessForm.name,
        password: this.accessForm.password,
        confirmPassword: this.accessForm.confirmPassword
      });
      this.authService.applyUser(response.user);
      this.statusMessage = response.message;
      await this.router.navigateByUrl("/cuenta");
    } catch (error) {
      this.errorMessage = this.readError(error, "No fue posible crear tu cuenta.");
    } finally {
      this.creatingAccount = false;
    }
  }

  async cancelSubscription(): Promise<void> {
    const token = this.token();

    if (!token) {
      return;
    }

    this.errorMessage = "";
    this.statusMessage = "";
    this.cancellingSubscription = true;

    try {
      const response = await this.publicApi.unsubscribeSubscription(token);
      this.statusMessage = response.message;
      this.state = "success";
      this.title = "Suscripción cancelada";
      this.message = "El boletín dejó de usar este correo. Si ya creaste tu cuenta, podrás seguir entrando al sitio con esa cuenta.";

      if (this.access?.subscription) {
        this.access = {
          ...this.access,
          subscription: {
            ...this.access.subscription,
            status: "cancelled"
          }
        };
      }
    } catch (error) {
      this.errorMessage = this.readError(error, "No fue posible cancelar la suscripción.");
    } finally {
      this.cancellingSubscription = false;
    }
  }

  private async loadAccess(): Promise<void> {
    const token = this.token();

    if (!token) {
      this.state = "error";
      this.title = "Enlace incompleto";
      this.message = "El enlace recibido no incluye un token de gestión válido.";
      return;
    }

    try {
      const response = await this.readerApi.getSubscriptionAccess(token);
      this.access = response;
      this.accessForm.name = response.readerAccount.name || response.subscription?.name || "";
      this.state = "ready";
      this.title = response.readerAccount.exists ? "Tu correo ya tiene cuenta" : "Activa tu cuenta";
      this.message = response.readerAccount.exists
        ? "Si ya habías creado la cuenta, puedes iniciar sesión o abrirla directamente si tu sesión sigue activa."
        : "Este correo ya está dentro del boletín. Solo falta crear una clave para comentar y gestionar tus aportes.";
    } catch (error) {
      this.state = "error";
      this.title = "No fue posible abrir esta gestión";
      this.message = this.readError(error, "El enlace de gestión ya no está disponible.");
    }
  }

  private validateAccessForm(): string {
    const name = this.accessForm.name.trim();
    const password = this.accessForm.password;

    if (name.length < 2) {
      return "Escribe un nombre visible de al menos 2 caracteres.";
    }

    if (!passwordMeetsPolicy(password)) {
      return this.passwordRequirementsMessage;
    }

    if (password !== this.accessForm.confirmPassword) {
      return "La confirmación no coincide con la contraseña.";
    }

    return "";
  }

  private token(): string {
    return this.route.snapshot.queryParamMap.get("token") ?? "";
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
}
