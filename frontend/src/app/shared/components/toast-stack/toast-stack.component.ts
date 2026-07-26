import { NgClass, NgFor } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { ToastService } from "../../../core/services/toast.service";

@Component({
  selector: "app-toast-stack",
  standalone: true,
  imports: [NgFor, NgClass],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        class="toast"
        *ngFor="let toast of toastService.items()"
        [ngClass]="'toast--' + toast.type"
        (click)="toastService.dismiss(toast.id)"
      >
        <span class="toast__label">{{ toast.type === "error" ? "Error" : toast.type === "success" ? "Listo" : "Info" }}</span>
        <strong>{{ toast.message }}</strong>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastStackComponent {
  readonly toastService = inject(ToastService);
}
