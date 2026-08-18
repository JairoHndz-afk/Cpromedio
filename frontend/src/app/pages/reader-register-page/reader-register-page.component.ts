import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AuthService } from "../../core/services/auth.service";
import { ReaderApiService } from "../../core/services/reader-api.service";
import { SeoService } from "../../core/services/seo.service";
import { PASSWORD_REQUIREMENTS_MESSAGE, passwordMeetsPolicy } from "../../core/utils/password-policy";

type ReaderRegisterPasswordField = "password" | "confirm";

@Component({
  selector: "app-reader-register-page",
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  template: `
    <section class="auth-shell">
      <article class="auth-card auth-card--reader">
        <p class="eyebrow">Registro</p>
        <h1>Crea tu cuenta</h1>
        <p class="helper-text">
          Al registrarte quedas suscrito por defecto al boletín editorial. Desde aquí podrás comentar, editar tus aportes,
          cambiar tu contraseña y subir tu foto de perfil.
        </p>

        <form class="reader-register-form" (ngSubmit)="submit()">
          <label>
            <span>Nombre visible</span>
            <input type="text" [(ngModel)]="form.name" name="readerName" autocomplete="name" [disabled]="submitting" required />
          </label>

          <label>
            <span>Correo</span>
            <input type="email" [(ngModel)]="form.email" name="readerEmail" autocomplete="email" [disabled]="submitting" required />
          </label>

          <label>
            <span>Contraseña</span>
            <div class="password-field">
              <input
                [type]="passwordVisibility.password ? 'text' : 'password'"
                [(ngModel)]="form.password"
                name="readerPassword"
                autocomplete="new-password"
                [disabled]="submitting"
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
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!passwordVisibility.password; else hidePasswordIcon">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <ng-template #hidePasswordIcon>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                    <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                    <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </ng-template>
              </button>
            </div>
            <p class="helper-text">{{ passwordRequirementsMessage }}</p>
          </label>

          <label>
            <span>Confirmar contraseña</span>
            <div class="password-field">
              <input
                [type]="passwordVisibility.confirm ? 'text' : 'password'"
                [(ngModel)]="form.confirmPassword"
                name="readerConfirmPassword"
                autocomplete="new-password"
                [disabled]="submitting"
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
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!passwordVisibility.confirm; else hideConfirmIcon">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <ng-template #hideConfirmIcon>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                    <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                    <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </ng-template>
              </button>
            </div>
          </label>

          <button class="button" type="submit" [disabled]="submitting">
            {{ submitting ? "Creando cuenta..." : "Registrarme" }}
          </button>

          <p class="helper-text" *ngIf="successMessage">{{ successMessage }}</p>
          <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
        </form>

        <div class="button-row">
          <a class="button button--ghost" [routerLink]="['/login']" [queryParams]="redirectQueryParams">Ya tengo cuenta</a>
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReaderRegisterPageComponent {
  private readonly readerApi = inject(ReaderApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  submitting = false;
  successMessage = "";
  errorMessage = "";
  readonly passwordRequirementsMessage = PASSWORD_REQUIREMENTS_MESSAGE;
  passwordVisibility: Record<ReaderRegisterPasswordField, boolean> = {
    password: false,
    confirm: false
  };
  form = {
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  };

  constructor() {
    this.seo.setNoIndex("Registro | Colombiano Promedio", "Registro privado para comentar y administrar tus aportes.");
  }

  get redirectQueryParams(): Record<string, string> {
    const redirect = this.redirectTarget();
    return redirect ? { redirect } : {};
  }

  togglePassword(field: ReaderRegisterPasswordField): void {
    this.passwordVisibility[field] = !this.passwordVisibility[field];
  }

  async submit(): Promise<void> {
    this.errorMessage = "";
    this.successMessage = "";

    const validationMessage = this.validateForm();

    if (validationMessage) {
      this.errorMessage = validationMessage;
      return;
    }

    this.submitting = true;

    try {
      const response = await this.readerApi.register(this.form);
      this.authService.applyUser(response.user);
      this.successMessage = response.message;
      await this.router.navigateByUrl(this.redirectTarget() || "/cuenta");
    } catch (error) {
      this.errorMessage = this.readError(error, "No fue posible crear tu cuenta.");
    } finally {
      this.submitting = false;
    }
  }

  private validateForm(): string {
    const name = this.form.name.trim();
    const email = this.form.email.trim();
    const password = this.form.password;

    if (name.length < 2) {
      return "Escribe un nombre visible de al menos 2 caracteres.";
    }

    if (!email || !email.includes("@")) {
      return "Ingresa un correo válido.";
    }

    if (!passwordMeetsPolicy(password)) {
      return this.passwordRequirementsMessage;
    }

    if (password !== this.form.confirmPassword) {
      return "La confirmación no coincide con la contraseña.";
    }

    return "";
  }

  private redirectTarget(): string {
    const redirect = this.route.snapshot.queryParamMap.get("redirect") ?? "";
    return redirect.startsWith("/") ? redirect : "";
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
