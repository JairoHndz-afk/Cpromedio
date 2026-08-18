import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AuthService } from "../../core/services/auth.service";
import { SeoService } from "../../core/services/seo.service";

@Component({
  selector: "app-login-page",
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  template: `
    <section class="auth-shell">
      <form class="auth-card" (ngSubmit)="submit()">
        <p class="eyebrow">Acceso</p>
        <h1>Ingresa al sitio</h1>
        <p class="helper-text">Desde aquí puedes entrar a tu cuenta para comentar, administrar tu perfil o acceder al panel editorial si haces parte del equipo.</p>

        <label>
          <span>Correo</span>
          <input type="email" [(ngModel)]="form.email" name="email" autocomplete="username" required />
        </label>

        <label>
          <span>Contraseña</span>
          <div class="password-field">
            <input
              [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="form.password"
              name="password"
              autocomplete="current-password"
              required
            />
            <button
              class="password-toggle"
              [class.is-active]="showPassword"
              type="button"
              [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              [attr.aria-pressed]="showPassword"
              (click)="togglePassword()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!showPassword; else hidePasswordIcon">
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
        </label>

        <button class="button" type="submit" [disabled]="submitting">
          {{ submitting ? "Ingresando..." : "Entrar" }}
        </button>

        <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>

        <div class="reader-login-note">
          <p class="helper-text">¿Todavía no tienes cuenta?</p>
          <a class="button button--ghost" [routerLink]="['/registro']" [queryParams]="redirectQueryParams">Registrarse</a>
        </div>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  submitting = false;
  showPassword = false;
  errorMessage = "";
  form = {
    email: "",
    password: ""
  };

  constructor() {
    this.seo.setNoIndex("Acceso al sitio | Colombiano Promedio", "Ingreso privado para cuentas del sitio y equipo editorial.");
  }

  get redirectQueryParams(): Record<string, string> {
    const redirect = this.redirectTarget();
    return redirect ? { redirect } : {};
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async submit(): Promise<void> {
    this.errorMessage = "";
    this.submitting = true;

    try {
      const user = await this.authService.login(this.form);
      await this.router.navigateByUrl(this.redirectTarget() || (user.role === "reader" ? "/cuenta" : "/dashboard"));
    } catch (error) {
      this.errorMessage = this.readError(error, "No fue posible iniciar sesión.");
    } finally {
      this.submitting = false;
    }
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
