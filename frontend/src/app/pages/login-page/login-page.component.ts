import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";

import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-login-page",
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <section class="auth-shell">
      <form class="auth-card" (ngSubmit)="submit()">
        <p class="eyebrow">Acceso editorial</p>
        <h1>Admin y periodistas</h1>
        <p class="helper-text">Ingreso protegido por sesión, roles y moderación editorial.</p>

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
              [attr.aria-label]="showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'"
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
          {{ submitting ? "Ingresando…" : "Entrar" }}
        </button>

        <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  submitting = false;
  showPassword = false;
  errorMessage = "";
  form = {
    email: "",
    password: ""
  };

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async submit(): Promise<void> {
    this.errorMessage = "";
    this.submitting = true;

    try {
      await this.authService.login(this.form);
      await this.router.navigateByUrl("/dashboard");
    } catch {
      this.errorMessage = "No fue posible iniciar sesión.";
    } finally {
      this.submitting = false;
    }
  }
}
