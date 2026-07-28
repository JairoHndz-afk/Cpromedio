import { DatePipe, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";

import { SiteCommunication } from "../../../core/types/api.types";

@Component({
  selector: "app-communication-modal",
  standalone: true,
  imports: [NgIf, DatePipe],
  template: `
    <section class="communication-modal" *ngIf="visible && communication">
      <button class="communication-modal__backdrop" type="button" (click)="dismiss.emit()" aria-label="Cerrar aviso editorial"></button>

      <article class="communication-modal__card" role="dialog" aria-modal="true" aria-labelledby="communication-modal-title">
        <div class="communication-modal__topbar">
          <div class="communication-modal__brand">
            <span class="communication-modal__brand-mark" aria-hidden="true"></span>
            <div>
              <p class="eyebrow">{{ communication.eyebrow || "Comunicado editorial" }}</p>
              <strong>Redacci&oacute;n de Colombiano Promedio</strong>
            </div>
          </div>

          <button class="communication-modal__close" type="button" (click)="dismiss.emit()" aria-label="Cerrar comunicado">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div class="communication-modal__surface">
          <div class="communication-modal__content">
            <span class="communication-modal__label">Actualizaci&oacute;n destacada</span>
            <h2 id="communication-modal-title">{{ communication.title }}</h2>
            <p class="communication-modal__copy">{{ communication.message }}</p>
          </div>

          <aside class="communication-modal__rail">
            <span class="count-pill">Se muestra una vez</span>
            <span class="count-pill count-pill--warm">Visible hasta {{ communication.expiresAt | date: "d MMM, h:mm a" : "" : "es-CO" }}</span>
          </aside>
        </div>

        <div class="communication-modal__footer">
          <div class="button-row communication-modal__actions">
            <a
              *ngIf="communication.ctaUrl"
              class="button"
              [attr.href]="communication.ctaUrl"
              [attr.target]="isExternalUrl(communication.ctaUrl) ? '_blank' : null"
              [attr.rel]="isExternalUrl(communication.ctaUrl) ? 'noopener noreferrer' : null"
              (click)="cta.emit()"
            >
              {{ communication.ctaLabel || "Leer ahora" }}
            </a>
            <button class="button button--ghost" type="button" (click)="dismiss.emit()">Cerrar</button>
          </div>

          <p class="helper-text communication-modal__helper">
            Este aviso se recuerda con una cookie esencial y solo volver&aacute; a mostrarse si la redacci&oacute;n publica una nueva versi&oacute;n.
          </p>
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunicationModalComponent {
  @Input({ required: true }) communication: SiteCommunication | null = null;
  @Input() visible = false;

  @Output() dismiss = new EventEmitter<void>();
  @Output() cta = new EventEmitter<void>();

  isExternalUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }
}
