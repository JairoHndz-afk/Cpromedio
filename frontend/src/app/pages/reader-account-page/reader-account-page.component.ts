import { DatePipe, NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../core/services/auth.service";
import { ReaderApiService } from "../../core/services/reader-api.service";
import { SeoService } from "../../core/services/seo.service";
import { ReaderAccountPayload, ReaderOwnComment } from "../../core/types/api.types";
import { PASSWORD_REQUIREMENTS_MESSAGE, passwordMeetsPolicy } from "../../core/utils/password-policy";

type ReaderPasswordField = "current" | "next" | "confirm";

@Component({
  selector: "app-reader-account-page",
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink, DatePipe],
  template: `
    <section class="reader-account-shell" *ngIf="account; else readerAccountLoading">
      <div class="reader-account-grid">
        <article class="reader-account-card reader-account-card--profile">
          <div class="reader-account-card__header">
            <div>
              <p class="eyebrow">Mi cuenta</p>
              <h1>Tu espacio de participación</h1>
              <p class="helper-text">Aquí administras tu nombre visible, tu foto y los comentarios que dejas en las noticias.</p>
            </div>
            <div class="reader-account-status" *ngIf="account?.subscription as subscription">
              <span class="tag tag--category">{{ subscription.plan === "premium" ? "Premium" : "Boletín" }}</span>
              <span class="tag">{{ subscriptionStatusLabel(subscription.status) }}</span>
            </div>
          </div>

          <div class="reader-account-profile">
            <div class="reader-account-avatar">
              <img
                *ngIf="profileForm.avatarUrl; else readerAvatarFallback"
                [src]="profileForm.avatarUrl"
                [alt]="profileForm.avatarAlt || 'Foto de perfil de la cuenta'"
              />
              <ng-template #readerAvatarFallback>
                <span>{{ initials(profileForm.name || account.user.name || "Cuenta") }}</span>
              </ng-template>
            </div>

            <div class="reader-account-profile__copy">
              <strong>{{ account.user.name }}</strong>
              <span>{{ account.user.email }}</span>
              <span class="helper-text">Tu cuenta sigue asociada a la suscripción editorial de este correo.</span>
            </div>
          </div>

          <form class="reader-account-form" (ngSubmit)="saveProfile()">
            <label>
              <span>Nombre visible</span>
              <input type="text" [(ngModel)]="profileForm.name" name="readerProfileName" [disabled]="savingProfile" required />
            </label>

            <label>
              <span>Correo asociado</span>
              <input type="email" [value]="account.user.email" readonly />
            </label>

            <div class="reader-account-form__upload">
              <div>
                <span>Foto de perfil</span>
                <p class="helper-text">Puedes subir PNG, JPG, WEBP, GIF o AVIF. Luego guarda el perfil para dejarla activa.</p>
              </div>
              <label class="button button--ghost reader-account-form__upload-button">
                {{ uploadingAvatar ? "Subiendo..." : "Subir foto" }}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" (change)="onAvatarSelected($event)" [disabled]="uploadingAvatar" />
              </label>
            </div>

            <div class="reader-account-name-lock" *ngIf="account.permissions.canChangeNameNow === false">
              <span class="tag">Cambio de nombre en pausa</span>
              <p class="helper-text">
                Podrás volver a cambiar tu nombre después del
                {{ account.permissions.nameChangeAvailableAt | date: "d MMM y, h:mm a" }}.
              </p>
            </div>

            <div class="button-row">
              <button class="button" type="submit" [disabled]="savingProfile">
                {{ savingProfile ? "Guardando..." : "Guardar perfil" }}
              </button>
            </div>

            <p class="helper-text" *ngIf="profileMessage">{{ profileMessage }}</p>
            <p class="error-text" *ngIf="profileError">{{ profileError }}</p>
          </form>
        </article>

        <article class="reader-account-card">
          <div class="reader-account-card__header">
            <div>
              <p class="eyebrow">Seguridad</p>
              <h2>Cambiar contraseña</h2>
            </div>
          </div>

          <form class="reader-account-form" (ngSubmit)="changePassword()">
            <label>
              <span>Contraseña actual</span>
              <div class="password-field">
                <input
                  [type]="passwordVisibility.current ? 'text' : 'password'"
                  [(ngModel)]="passwordForm.currentPassword"
                  name="readerCurrentPassword"
                  autocomplete="current-password"
                  [disabled]="changingPassword"
                  required
                />
                <button
                  class="password-toggle"
                  [class.is-active]="passwordVisibility.current"
                  type="button"
                  [attr.aria-pressed]="passwordVisibility.current"
                  [attr.aria-label]="passwordVisibility.current ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'"
                  (click)="togglePassword('current')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" *ngIf="!passwordVisibility.current" />
                    <circle cx="12" cy="12" r="3.2" *ngIf="!passwordVisibility.current" />
                    <g *ngIf="passwordVisibility.current">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                      <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                      <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                    </g>
                  </svg>
                </button>
              </div>
            </label>

            <label>
              <span>Nueva contraseña</span>
              <div class="password-field">
                <input
                  [type]="passwordVisibility.next ? 'text' : 'password'"
                  [(ngModel)]="passwordForm.nextPassword"
                  name="readerNextPassword"
                  autocomplete="new-password"
                  [disabled]="changingPassword"
                  required
                />
                <button
                  class="password-toggle"
                  [class.is-active]="passwordVisibility.next"
                  type="button"
                  [attr.aria-pressed]="passwordVisibility.next"
                  [attr.aria-label]="passwordVisibility.next ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'"
                  (click)="togglePassword('next')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" *ngIf="!passwordVisibility.next" />
                    <circle cx="12" cy="12" r="3.2" *ngIf="!passwordVisibility.next" />
                    <g *ngIf="passwordVisibility.next">
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
              <span>Confirmar nueva contraseña</span>
              <div class="password-field">
                <input
                  [type]="passwordVisibility.confirm ? 'text' : 'password'"
                  [(ngModel)]="passwordForm.confirmPassword"
                  name="readerConfirmPassword"
                  autocomplete="new-password"
                  [disabled]="changingPassword"
                  required
                />
                <button
                  class="password-toggle"
                  [class.is-active]="passwordVisibility.confirm"
                  type="button"
                  [attr.aria-pressed]="passwordVisibility.confirm"
                  [attr.aria-label]="passwordVisibility.confirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'"
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
              <button class="button" type="submit" [disabled]="changingPassword">
                {{ changingPassword ? "Actualizando..." : "Actualizar contraseña" }}
              </button>
            </div>

            <p class="helper-text" *ngIf="passwordMessage">{{ passwordMessage }}</p>
            <p class="error-text" *ngIf="passwordError">{{ passwordError }}</p>
          </form>
        </article>
      </div>

      <article class="reader-account-card reader-account-card--comments">
        <div class="reader-account-card__header">
          <div>
            <p class="eyebrow">Tus comentarios</p>
            <h2>Gestiona lo que ya publicaste</h2>
            <p class="helper-text">Los cambios se guardan al instante y la censura automática vuelve a aplicarse si detecta insultos fuertes.</p>
          </div>
          <a class="button button--ghost" routerLink="/">Ir a portada</a>
        </div>

        <p class="helper-text" *ngIf="loadingComments">Cargando tus comentarios...</p>
        <p class="helper-text" *ngIf="commentsMessage">{{ commentsMessage }}</p>
        <p class="error-text" *ngIf="commentsError">{{ commentsError }}</p>

        <div class="reader-account-comments" *ngIf="comments.length > 0; else readerCommentsEmpty">
          <article class="reader-comment-card" *ngFor="let comment of comments; trackBy: trackComment">
            <div class="reader-comment-card__header">
              <div>
                <a class="reader-comment-card__article" *ngIf="comment.article" [routerLink]="['/articulo', comment.article.slug]">
                  {{ comment.article.title }}
                </a>
                <strong *ngIf="!comment.article">Publicación ya no disponible</strong>
                <div class="meta-row">
                  <span class="meta-pill meta-pill--author">{{ statusLabel(comment.status) }}</span>
                  <span class="meta-pill meta-pill--soft">{{ comment.createdAt | date: "d MMM y, h:mm a" }}</span>
                  <span class="meta-pill meta-pill--warm" *ngIf="comment.censored">Texto censurado</span>
                </div>
              </div>
              <div class="button-row reader-comment-card__actions">
                <button class="button button--ghost" type="button" *ngIf="editingCommentId !== comment.id && comment.canEdit" (click)="startEditing(comment)">
                  Editar
                </button>
                <button class="button button--ghost" type="button" *ngIf="editingCommentId === comment.id" (click)="cancelEditing()">
                  Cancelar
                </button>
                <button class="button button--secondary" type="button" (click)="deleteComment(comment)">
                  Retirar
                </button>
              </div>
            </div>

            <textarea
              *ngIf="editingCommentId === comment.id; else readerCommentBody"
              [(ngModel)]="commentDraft"
              name="readerCommentDraft"
              rows="4"
            ></textarea>

            <ng-template #readerCommentBody>
              <p>{{ comment.body }}</p>
            </ng-template>

            <div class="button-row" *ngIf="editingCommentId === comment.id">
              <button class="button" type="button" [disabled]="savingComment" (click)="saveComment(comment)">
                {{ savingComment ? "Guardando..." : "Guardar comentario" }}
              </button>
            </div>
          </article>
        </div>

        <ng-template #readerCommentsEmpty>
          <p class="empty-state" *ngIf="!loadingComments">Todavía no has publicado comentarios. Cuando participes en una noticia, aparecerán aquí.</p>
        </ng-template>
      </article>
    </section>

    <ng-template #readerAccountLoading>
      <section class="loading-state reader-account-loading">
        <p class="eyebrow">Mi cuenta</p>
        <h1>Cargando tu espacio de participación</h1>
        <p class="helper-text">{{ loadError || "Estamos trayendo tu perfil, tu suscripción y tus comentarios." }}</p>
      </section>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReaderAccountPageComponent {
  private readonly readerApi = inject(ReaderApiService);
  private readonly authService = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  account: ReaderAccountPayload | null = null;
  comments: ReaderOwnComment[] = [];
  loadError = "";
  profileMessage = "";
  profileError = "";
  passwordMessage = "";
  passwordError = "";
  commentsMessage = "";
  commentsError = "";
  savingProfile = false;
  changingPassword = false;
  uploadingAvatar = false;
  loadingComments = false;
  savingComment = false;
  editingCommentId: string | null = null;
  commentDraft = "";
  readonly passwordRequirementsMessage = PASSWORD_REQUIREMENTS_MESSAGE;
  passwordVisibility: Record<ReaderPasswordField, boolean> = {
    current: false,
    next: false,
    confirm: false
  };
  profileForm = {
    name: "",
    avatarUrl: "",
    avatarAlt: ""
  };
  passwordForm = {
    currentPassword: "",
    nextPassword: "",
    confirmPassword: ""
  };

  constructor() {
    this.seo.setNoIndex("Mi cuenta | Colombiano Promedio", "Panel privado para comentar y administrar tus aportes.");
    void this.loadAll();
  }

  initials(value: string): string {
    return value
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "CP";
  }

  togglePassword(field: ReaderPasswordField): void {
    this.passwordVisibility[field] = !this.passwordVisibility[field];
  }

  trackComment(_index: number, comment: ReaderOwnComment): string {
    return comment.id;
  }

  subscriptionStatusLabel(status: "pending" | "active" | "paused" | "cancelled"): string {
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

  statusLabel(status: ReaderOwnComment["status"]): string {
    if (status === "approved") {
      return "Visible";
    }

    if (status === "hidden") {
      return "Oculto";
    }

    if (status === "rejected") {
      return "Rechazado";
    }

    return "Pendiente";
  }

  async saveProfile(): Promise<void> {
    this.profileMessage = "";
    this.profileError = "";
    this.savingProfile = true;

    try {
      const response = await this.readerApi.updateProfile(this.profileForm);
      this.authService.applyUser(response.user);
      this.profileMessage = "Perfil actualizado.";
      await this.loadAccount();
    } catch (error) {
      this.profileError = this.readError(error, "No fue posible guardar tu perfil.");
    } finally {
      this.savingProfile = false;
      this.cdr.markForCheck();
    }
  }

  async changePassword(): Promise<void> {
    this.passwordMessage = "";
    this.passwordError = "";

    if (!passwordMeetsPolicy(this.passwordForm.nextPassword)) {
      this.passwordError = this.passwordRequirementsMessage;
      this.cdr.markForCheck();
      return;
    }

    if (this.passwordForm.nextPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = "La confirmación no coincide con la nueva contraseña.";
      this.cdr.markForCheck();
      return;
    }

    this.changingPassword = true;

    try {
      const response = await this.readerApi.changePassword(this.passwordForm);
      this.passwordMessage = response.message;
      this.passwordForm = {
        currentPassword: "",
        nextPassword: "",
        confirmPassword: ""
      };
      this.passwordVisibility.current = false;
      this.passwordVisibility.next = false;
      this.passwordVisibility.confirm = false;
    } catch (error) {
      this.passwordError = this.readError(error, "No fue posible actualizar la contraseña.");
    } finally {
      this.changingPassword = false;
      this.cdr.markForCheck();
    }
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    this.uploadingAvatar = true;
    this.profileMessage = "";
    this.profileError = "";

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const uploaded = await this.readerApi.uploadAvatar({
        dataUrl,
        filename: file.name,
        alt: this.profileForm.avatarAlt || `Foto de ${this.profileForm.name || "la cuenta"}`
      });

      this.profileForm.avatarUrl = uploaded.url;
      this.profileForm.avatarAlt = uploaded.alt || `Foto de ${this.profileForm.name || "la cuenta"}`;
      this.profileMessage = "Foto cargada. Guarda el perfil para dejarla activa.";
    } catch (error) {
      this.profileError = this.readError(error, "No fue posible subir la foto.");
    } finally {
      this.uploadingAvatar = false;

      if (input) {
        input.value = "";
      }

      this.cdr.markForCheck();
    }
  }

  startEditing(comment: ReaderOwnComment): void {
    this.editingCommentId = comment.id;
    this.commentDraft = comment.body;
    this.commentsMessage = "";
    this.commentsError = "";
  }

  cancelEditing(): void {
    this.editingCommentId = null;
    this.commentDraft = "";
  }

  async saveComment(comment: ReaderOwnComment): Promise<void> {
    const body = this.commentDraft.trim();

    if (body.length < 8) {
      this.commentsError = "Escribe un comentario de al menos 8 caracteres.";
      return;
    }

    this.savingComment = true;
    this.commentsMessage = "";
    this.commentsError = "";

    try {
      const response = await this.readerApi.updateOwnComment(comment.id, {
        body
      });
      this.comments = this.comments.map((item) => (item.id === comment.id ? response.comment : item));
      this.editingCommentId = null;
      this.commentDraft = "";
      this.commentsMessage = "Comentario actualizado.";
    } catch (error) {
      this.commentsError = this.readError(error, "No fue posible actualizar el comentario.");
    } finally {
      this.savingComment = false;
      this.cdr.markForCheck();
    }
  }

  async deleteComment(comment: ReaderOwnComment): Promise<void> {
    if (!window.confirm("Este comentario se retirará de la noticia. ¿Quieres continuar?")) {
      return;
    }

    this.commentsMessage = "";
    this.commentsError = "";

    try {
      const response = await this.readerApi.deleteOwnComment(comment.id);
      this.comments = this.comments.filter((item) => item.id !== comment.id);
      this.commentsMessage = response.message;

      if (this.editingCommentId === comment.id) {
        this.cancelEditing();
      }
    } catch (error) {
      this.commentsError = this.readError(error, "No fue posible retirar el comentario.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async loadAll(): Promise<void> {
    try {
      await Promise.all([this.loadAccount(), this.loadComments()]);
    } catch (error) {
      this.loadError = this.readError(error, "No fue posible cargar tu cuenta.");
      this.cdr.markForCheck();
    }
  }

  private async loadAccount(): Promise<void> {
    const response = await this.readerApi.getAccount();
    this.account = response;
    this.profileForm = {
      name: response.user.name,
      avatarUrl: response.user.avatar.url,
      avatarAlt: response.user.avatar.alt
    };
    this.cdr.markForCheck();
  }

  private async loadComments(): Promise<void> {
    this.loadingComments = true;

    try {
      const response = await this.readerApi.getOwnComments();
      this.comments = response.items;
    } finally {
      this.loadingComments = false;
      this.cdr.markForCheck();
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("No fue posible leer la imagen seleccionada."));
      };

      reader.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
      reader.readAsDataURL(file);
    });
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
