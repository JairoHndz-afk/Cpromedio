import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { AuthService } from "./core/services/auth.service";
import { ThemeService } from "./core/services/theme.service";
import { FooterComponent } from "./shared/components/footer/footer.component";
import { HeaderComponent } from "./shared/components/header/header.component";
import { ToastStackComponent } from "./shared/components/toast-stack/toast-stack.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastStackComponent],
  template: `
    <div class="page-shell">
      <app-header></app-header>

      <main class="site-main">
        <router-outlet></router-outlet>
      </main>

      <app-footer></app-footer>
      <app-toast-stack></app-toast-stack>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  constructor() {
    this.themeService.init();
    void this.authService.restoreSession();
  }
}
