import { DatePipe, NgClass, NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

import { AuthService } from "../../core/services/auth.service";
import { DashboardApiService } from "../../core/services/dashboard-api.service";
import { SeoService } from "../../core/services/seo.service";
import { ToastService } from "../../core/services/toast.service";
import {
  ArticleContentBlock,
  AuditEntry,
  Category,
  DashboardArticle,
  DashboardOverview,
  SubscriptionEntry,
  UserSession
} from "../../core/types/api.types";
import { resolveVideoEmbed } from "../../core/utils/video-embed";

type DashboardSection = "overview" | "articles" | "team" | "categories" | "audience" | "profile";
type ArticleEditorStep = "body" | "preview" | "subtitle" | "title" | "settings" | "review";
type PasswordFieldKey = "user" | "current" | "next" | "confirm";

interface SectionConfig {
  id: DashboardSection;
  label: string;
  description: string;
  adminOnly?: boolean;
}

interface ArticleEditorStepConfig {
  id: ArticleEditorStep;
  order: number;
  label: string;
  description: string;
}

interface ArticleFormState {
  title: string;
  subtitle: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  coverPositionX: number;
  coverPositionY: number;
  coverType: "image" | "video" | "audio" | "infographic";
  categoryId: string;
  tags: string;
  isPremium: boolean;
  featured: boolean;
  status: "draft" | "review" | "changes_requested" | "approved" | "published" | "archived" | "rejected";
  contentBlocks: EditorContentBlock[];
}

interface EditorContentBlock {
  type: ArticleContentBlock["type"];
  text: string;
  quoteText: string;
  quoteAttribution: string;
  imageUrl: string;
  imageAlt: string;
  imageCaption: string;
  embedUrl: string;
  embedTitle: string;
  uploading: boolean;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "danger" | "neutral";
}

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, DatePipe],
  template: `
    <section class="dashboard-shell" *ngIf="authService.user() as currentUser">
      <header class="dashboard-header">
        <div>
          <p class="eyebrow">Panel editorial</p>
          <h1>{{ currentUser.role === "admin" ? "Moderacion editorial" : "Espacio del periodista" }}</h1>
          <p class="helper-text">{{ currentUser.name }} | {{ currentUser.email }}</p>
        </div>

        <div class="dashboard-header__actions">
          <button class="button button--secondary" type="button" (click)="startNewArticle()">Nuevo articulo</button>
          <button class="button button--ghost" type="button" (click)="selectSection('profile')">Mi perfil</button>
        </div>
      </header>

      <div class="dashboard-metrics" *ngIf="overview">
        <div class="metric-tile">
          <strong>{{ overview.metrics.articleCount }}</strong>
          <span>Articulos</span>
        </div>
        <div class="metric-tile">
          <strong>{{ overview.metrics.reviewCount }}</strong>
          <span>En revision</span>
        </div>
        <div class="metric-tile">
          <strong>{{ overview.metrics.publishedCount }}</strong>
          <span>Publicados</span>
        </div>
        <div class="metric-tile" *ngIf="currentUser.role === 'admin'">
          <strong>{{ overview.metrics.usersCount }}</strong>
          <span>Usuarios</span>
        </div>
      <div class="metric-tile" *ngIf="currentUser.role === 'admin'">
          <strong>{{ overview.metrics.subscriptionsCount }}</strong>
          <span>Suscripciones</span>
        </div>
      </div>

      <nav class="dashboard-nav" aria-label="Secciones internas">
        <button
          type="button"
          class="dashboard-tab"
          *ngFor="let section of visibleSections(currentUser)"
          [ngClass]="{ 'is-active': activeSection === section.id }"
          (click)="selectSection(section.id)"
        >
          <span>{{ section.label }}</span>
          <small>{{ section.description }}</small>
        </button>
      </nav>

      <section class="dashboard-overview" *ngIf="activeSection === 'overview'">
        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p class="panel-subtitle">Acceso rapido a las piezas que se estan moviendo hoy.</p>
            </div>
            <button class="button button--ghost" type="button" (click)="selectSection('articles')">Ir a articulos</button>
          </div>

          <div class="dashboard-list">
            <button
              type="button"
              class="article-row"
              *ngFor="let article of overview?.recentArticles || []"
              (click)="openArticleEditor(article)"
            >
              <strong>{{ article.title }}</strong>
              <span>{{ formatArticleStatus(article.status) }} | {{ article.author?.name || "Redaccion" }}</span>
            </button>
            <p class="empty-state" *ngIf="(overview?.recentArticles || []).length === 0">Todavia no hay actividad editorial.</p>
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Mas vistos</h2>
              <p class="panel-subtitle">Trafico y piezas con mejor lectura.</p>
            </div>
          </div>

          <div class="dashboard-list">
            <div class="history-row" *ngFor="let article of overview?.topViewedArticles || []">
              <strong>{{ article.title }}</strong>
              <span>{{ article.metrics.views }} vistas | {{ formatArticleStatus(article.status) }}</span>
              <p>{{ article.author?.name || "Redaccion" }}</p>
            </div>
            <p class="empty-state" *ngIf="(overview?.topViewedArticles || []).length === 0">Aun no hay suficientes vistas para mostrar tendencia.</p>
          </div>
        </section>

        <section class="dashboard-panel dashboard-panel--accent">
          <div class="panel-heading">
            <div>
              <h2>Cuenta y atajos</h2>
              <p class="panel-subtitle">Perfil, seguridad y acceso directo a tus tareas.</p>
            </div>
          </div>

          <div class="profile-summary">
            <div class="profile-summary__badge">{{ initials(currentUser.name) }}</div>
            <div>
              <strong>{{ currentUser.name }}</strong>
              <p>{{ currentUser.email }}</p>
              <span>{{ formatRole(currentUser.role) }} | {{ formatUserStatus(currentUser.status) }}</span>
            </div>
          </div>

          <div class="button-row">
            <button class="button" type="button" (click)="selectSection('profile')">Editar perfil</button>
            <button class="button button--secondary" type="button" (click)="selectSection('articles')">Redactar</button>
            <button class="button button--ghost" type="button" *ngIf="currentUser.role === 'admin'" (click)="selectSection('team')">
              Gestionar equipo
            </button>
          </div>
        </section>
      </section>

      <section class="dashboard-grid" *ngIf="activeSection === 'articles'">
        <aside class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Articulos</h2>
              <p class="panel-subtitle">Selecciona una pieza o arranca una nueva.</p>
            </div>
            <span class="count-pill">{{ articlePagination.total }}</span>
          </div>

          <div class="filter-row">
            <input type="text" [(ngModel)]="articleSearch" name="articleSearch" placeholder="Buscar por titulo" />
            <select [(ngModel)]="articleStatusFilter" name="articleStatusFilter">
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="review">En revision</option>
              <option value="changes_requested">Cambios solicitados</option>
              <option value="approved">Aprobado</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
              <option value="rejected">Rechazado</option>
            </select>
            <button class="button button--ghost" type="button" (click)="applyArticleFilters()">Filtrar</button>
          </div>

          <div class="dashboard-list">
            <button
              type="button"
              class="article-row"
              *ngFor="let article of articles"
              (click)="editArticle(article)"
              [class.article-row--active]="selectedArticleId === article.id"
            >
              <strong>{{ article.title }}</strong>
              <span>{{ formatArticleStatus(article.status) }} | {{ article.author?.name || "Redaccion" }} | {{ article.metrics.views }} vistas</span>
            </button>
            <p class="empty-state" *ngIf="articles.length === 0">No hay articulos para esos filtros.</p>
          </div>

          <div class="panel-heading" *ngIf="articlePagination.total > 0">
            <div>
              <p class="helper-text">
                Pagina {{ articlePagination.page }} de {{ articlePagination.totalPages }} | {{ articlePagination.total }} articulos en total
              </p>
            </div>
            <div class="button-row" *ngIf="articlePagination.totalPages > 1">
              <button
                class="button button--ghost"
                type="button"
                (click)="changeArticlePage(articlePagination.page - 1)"
                [disabled]="articlePagination.page <= 1"
              >
                Anterior
              </button>
              <button
                class="button button--ghost"
                type="button"
                (click)="changeArticlePage(articlePagination.page + 1)"
                [disabled]="articlePagination.page >= articlePagination.totalPages"
              >
                Siguiente
              </button>
            </div>
          </div>
        </aside>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>{{ selectedArticleId ? "Editar articulo" : "Redactar articulo" }}</h2>
              <p class="panel-subtitle">Texto, portada, etiquetas y flujo editorial.</p>
            </div>
            <div class="button-row">
              <button class="button button--ghost" type="button" *ngIf="selectedArticleId" (click)="resetArticleForm()">Limpiar</button>
              <button
                class="button button--ghost"
                type="button"
                *ngIf="selectedArticleId && canDeleteSelectedArticle(currentUser)"
                [disabled]="deletingArticle"
                (click)="deleteArticle()"
              >
                {{ deletingArticle ? "Enviando..." : "Enviar a papelera" }}
              </button>
            </div>
          </div>

          <nav class="editor-stepper" aria-label="Flujo de redaccion">
            <button
              type="button"
              class="editor-step"
              *ngFor="let step of articleSteps"
              [ngClass]="{
                'is-active': activeArticleStep === step.id,
                'is-unlocked': canOpenArticleStep(step.id),
                'is-complete': isArticleStepComplete(step.id)
              }"
              [disabled]="!canOpenArticleStep(step.id)"
              (click)="openArticleStep(step.id)"
            >
              <span class="editor-step__count">{{ step.order }}</span>
              <strong>{{ step.label }}</strong>
              <small>{{ step.description }}</small>
            </button>
          </nav>

          <form class="editor-form editor-form--guided" novalidate>
            <section class="editor-stage" *ngIf="activeArticleStep === 'body'">
              <div class="panel-heading">
                <div>
                  <h3>Cuerpo de la noticia</h3>
                  <p class="panel-subtitle">Empieza por el contenido real: parrafos, fotos y videos embebidos entre bloques.</p>
                </div>
                <div class="button-row">
                  <button class="button button--ghost" type="button" (click)="addParagraphBlock()">Agregar parrafo</button>
                  <button class="button button--ghost" type="button" (click)="addQuoteBlock()">Agregar cita</button>
                  <button class="button button--secondary" type="button" (click)="addImageBlock()">Agregar foto</button>
                  <button class="button button--ghost" type="button" (click)="addEmbedBlock()">Agregar video</button>
                </div>
              </div>

              <div class="editor-note">
                <strong>Importante</strong>
                <p>Todo lo que agregues aqui vive dentro del cuerpo de la noticia. La portada principal se configura en el siguiente paso.</p>
              </div>

              <div class="content-builder-toolbar" role="toolbar" aria-label="Accesos rapidos para agregar bloques">
                <div class="content-builder-toolbar__label">
                  <strong>Inserta contenido sin volver al inicio</strong>
                  <span>Esta barra se queda visible mientras redactas y cada bloque tambien te deja agregar contenido justo debajo.</span>
                </div>
                <div class="button-row">
                  <button class="button button--ghost" type="button" (click)="addParagraphBlock()">Agregar parrafo</button>
                  <button class="button button--ghost" type="button" (click)="addQuoteBlock()">Agregar cita</button>
                  <button class="button button--secondary" type="button" (click)="addImageBlock()">Agregar foto</button>
                  <button class="button button--ghost" type="button" (click)="addEmbedBlock()">Agregar video</button>
                </div>
              </div>

              <div class="content-builder">
                <section class="content-block" *ngFor="let block of articleForm.contentBlocks; let blockIndex = index" [attr.data-content-block-index]="blockIndex">
                  <div class="content-block__header">
                    <span class="count-pill">{{ contentBlockLabel(block.type) }}</span>
                    <div class="button-row">
                      <button class="button button--ghost" type="button" (click)="moveContentBlock(blockIndex, -1)">Subir</button>
                      <button class="button button--ghost" type="button" (click)="moveContentBlock(blockIndex, 1)">Bajar</button>
                      <button class="button button--ghost" type="button" (click)="removeContentBlock(blockIndex)">Quitar</button>
                    </div>
                  </div>

                  <ng-container *ngIf="block.type === 'paragraph'">
                    <div class="button-row">
                      <button class="button button--ghost" type="button" (click)="insertSmartQuotes(blockIndex)">Insertar comillas</button>
                      <button class="button button--ghost" type="button" (click)="insertLinkTemplate(blockIndex)">Insertar enlace</button>
                    </div>
                    <label>
                      <span>Texto del parrafo</span>
                      <textarea
                        [(ngModel)]="block.text"
                        [name]="'blockText' + blockIndex"
                        [attr.id]="'editorBlockText' + blockIndex"
                        rows="6"
                      ></textarea>
                    </label>
                    <p class="helper-text">Acepta enlaces directos como https://... y formato [texto](https://...).</p>
                  </ng-container>

                  <ng-container *ngIf="block.type === 'quote'">
                    <div class="stack-form">
                      <label>
                        <span>Texto de la cita</span>
                        <textarea [(ngModel)]="block.quoteText" [name]="'blockQuoteText' + blockIndex" rows="4"></textarea>
                      </label>

                      <label>
                        <span>Fuente o atribucion</span>
                        <input type="text" [(ngModel)]="block.quoteAttribution" [name]="'blockQuoteAttribution' + blockIndex" placeholder="Autor, medio o contexto" />
                      </label>

                      <p class="helper-text">Usa este bloque para destacar frases dentro de la lectura sin mezclarlas con los parrafos normales.</p>
                    </div>
                  </ng-container>

                  <ng-container *ngIf="block.type === 'image'">
                    <div class="stack-form">
                      <label>
                        <span>Ruta o URL interna de la foto</span>
                        <input type="url" [(ngModel)]="block.imageUrl" [name]="'blockImageUrl' + blockIndex" placeholder="/uploads/news/2026/07/mi-foto.webp" />
                      </label>

                      <label>
                        <span>Subir foto desde tu computador</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                          (change)="onContentImageSelected($event, blockIndex)"
                          [disabled]="block.uploading"
                        />
                      </label>

                      <div class="form-grid">
                        <label>
                          <span>Texto alternativo</span>
                          <input type="text" [(ngModel)]="block.imageAlt" [name]="'blockImageAlt' + blockIndex" />
                        </label>

                        <label>
                          <span>Leyenda</span>
                          <input type="text" [(ngModel)]="block.imageCaption" [name]="'blockImageCaption' + blockIndex" />
                        </label>
                      </div>

                      <p class="helper-text">Por seguridad, solo se aceptan imagenes subidas al propio servidor del medio.</p>
                      <p class="helper-text" *ngIf="block.uploading">Subiendo imagen...</p>

                      <figure class="editor-image-preview" *ngIf="block.imageUrl">
                        <img [src]="block.imageUrl" [alt]="block.imageAlt || 'Vista previa de imagen'" />
                        <figcaption *ngIf="block.imageCaption">{{ block.imageCaption }}</figcaption>
                      </figure>
                    </div>
                  </ng-container>

                  <ng-container *ngIf="block.type === 'embed'">
                    <div class="stack-form">
                      <label>
                        <span>Enlace del video embebido</span>
                        <input
                          type="url"
                          [(ngModel)]="block.embedUrl"
                          [name]="'blockEmbedUrl' + blockIndex"
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </label>

                      <label>
                        <span>Titulo opcional del video</span>
                        <input type="text" [(ngModel)]="block.embedTitle" [name]="'blockEmbedTitle' + blockIndex" />
                      </label>

                      <p class="helper-text">Acepta enlaces de YouTube o Vimeo para insertarlos dentro del cuerpo.</p>

                      <div class="editor-embed-preview" *ngIf="safeBlockEmbedUrl(block) as embedUrl">
                        <iframe
                          [src]="embedUrl"
                          [title]="block.embedTitle || 'Vista previa del video embebido'"
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowfullscreen
                        ></iframe>
                      </div>

                      <p class="helper-text helper-text--danger" *ngIf="block.embedUrl && !safeBlockEmbedUrl(block)">
                        El enlace aun no es compatible. Usa YouTube o Vimeo.
                      </p>
                    </div>
                  </ng-container>

                  <div class="content-block__quick-add">
                    <span class="helper-text">Agregar debajo de este bloque</span>
                    <div class="button-row">
                      <button class="button button--ghost" type="button" (click)="insertParagraphBlock(blockIndex)">Texto debajo</button>
                      <button class="button button--ghost" type="button" (click)="insertQuoteBlock(blockIndex)">Cita debajo</button>
                      <button class="button button--secondary" type="button" (click)="insertImageBlock(blockIndex)">Foto debajo</button>
                      <button class="button button--ghost" type="button" (click)="insertEmbedBlock(blockIndex)">Video debajo</button>
                    </div>
                  </div>
                </section>
              </div>

              <div class="editor-stage__actions">
                <button class="button" type="button" (click)="continueArticleStep()">Continuar con previsualizacion</button>
              </div>
            </section>

            <section class="editor-stage" *ngIf="activeArticleStep === 'preview'">
              <div class="panel-heading">
                <div>
                  <h3>Previsualizacion y portada</h3>
                  <p class="panel-subtitle">Aqui defines el resumen corto y la imagen principal de portada, separados del cuerpo.</p>
                </div>
              </div>

              <div class="editor-stage__grid">
                <section class="editor-stage-card">
                  <h4>Previsualizacion corta</h4>
                  <p class="helper-text">Este texto se usa en tarjetas, listados y espacios de resumen. Puedes editarlo o usar la sugerencia automatica.</p>
                  <label>
                    <span>Previsualizacion corta</span>
                    <textarea [(ngModel)]="articleForm.excerpt" name="excerpt" rows="5"></textarea>
                  </label>
                  <div class="button-row">
                    <button class="button button--ghost" type="button" (click)="applySuggestedPreview()">Usar sugerencia automatica</button>
                  </div>
                </section>

                <section class="editor-stage-card editor-stage-card--accent">
                  <h4>Portada principal</h4>
                  <p class="helper-text">Esta portada solo afecta home, tarjetas y cabecera del articulo. No cambia las fotos del cuerpo.</p>

                  <div class="form-grid">
                    <label>
                      <span>Tipo de portada</span>
                      <select [(ngModel)]="articleForm.coverType" name="coverType">
                        <option value="image">Imagen</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="infographic">Infografia</option>
                      </select>
                    </label>

                    <label>
                      <span>Texto alternativo de portada</span>
                      <input type="text" [(ngModel)]="articleForm.coverAlt" name="coverAlt" />
                    </label>
                  </div>

                  <label>
                    <span>Ruta o URL interna de portada</span>
                    <input type="url" [(ngModel)]="articleForm.coverUrl" name="coverUrl" placeholder="/uploads/news/2026/07/portada.webp" />
                  </label>

                  <label *ngIf="isVisualCoverType(articleForm.coverType)">
                    <span>Subir portada desde tu computador</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      (change)="onCoverImageSelected($event)"
                      [disabled]="uploadingCover"
                    />
                  </label>

                  <p class="helper-text">Por seguridad, la portada debe provenir de archivos subidos al servidor del medio.</p>
                  <p class="helper-text" *ngIf="uploadingCover">Subiendo portada...</p>

                  <div class="form-grid" *ngIf="articleForm.coverUrl && isVisualCoverType(articleForm.coverType)">
                    <label>
                      <span>Enfoque horizontal: {{ articleForm.coverPositionX }}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        [(ngModel)]="articleForm.coverPositionX"
                        name="coverPositionX"
                      />
                    </label>

                    <label>
                      <span>Enfoque vertical: {{ articleForm.coverPositionY }}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        [(ngModel)]="articleForm.coverPositionY"
                        name="coverPositionY"
                      />
                    </label>
                  </div>

                  <figure class="editor-image-preview editor-image-preview--cover" *ngIf="articleForm.coverUrl && isVisualCoverType(articleForm.coverType)">
                    <img
                      [src]="articleForm.coverUrl"
                      [alt]="articleForm.coverAlt || 'Vista previa de portada'"
                      [style.object-position]="coverObjectPosition(articleForm.coverPositionX, articleForm.coverPositionY)"
                    />
                    <figcaption *ngIf="articleForm.coverAlt">{{ articleForm.coverAlt }}</figcaption>
                  </figure>

                  <div class="editor-embed-preview" *ngIf="articleForm.coverType === 'video' && safeEmbedUrl(articleForm.coverUrl) as coverVideo">
                    <iframe
                      [src]="coverVideo"
                      title="Vista previa del video de portada"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                    ></iframe>
                  </div>

                  <audio controls *ngIf="articleForm.coverType === 'audio' && articleForm.coverUrl">
                    <source [src]="articleForm.coverUrl" />
                  </audio>
                </section>
              </div>

              <div class="editor-stage__actions">
                <button class="button button--ghost" type="button" (click)="goToPreviousArticleStep()">Volver</button>
                <button class="button" type="button" (click)="continueArticleStep()">Continuar con subtitulo</button>
              </div>
            </section>

            <section class="editor-stage" *ngIf="activeArticleStep === 'subtitle'">
              <div class="panel-heading">
                <div>
                  <h3>Subtitulo</h3>
                  <p class="panel-subtitle">Dale contexto a la nota. Si no hace falta, puedes dejarlo vacio y continuar.</p>
                </div>
              </div>

              <label>
                <span>Subtitulo</span>
                <input type="text" [(ngModel)]="articleForm.subtitle" name="subtitle" />
              </label>

              <div class="editor-stage__actions">
                <button class="button button--ghost" type="button" (click)="goToPreviousArticleStep()">Volver</button>
                <button class="button" type="button" (click)="continueArticleStep()">Continuar con titulo</button>
              </div>
            </section>

            <section class="editor-stage" *ngIf="activeArticleStep === 'title'">
              <div class="panel-heading">
                <div>
                  <h3>Titulo final</h3>
                  <p class="panel-subtitle">Este es el titular principal que vera la audiencia en portada y en la lectura completa.</p>
                </div>
              </div>

              <label>
                <span>Titulo</span>
                <input type="text" [(ngModel)]="articleForm.title" name="title" required />
              </label>

              <div class="editor-note editor-note--warm" *ngIf="articleForm.title.trim()">
                <strong>Lectura del titular</strong>
                <p>{{ articleForm.title }}</p>
              </div>

              <div class="editor-stage__actions">
                <button class="button button--ghost" type="button" (click)="goToPreviousArticleStep()">Volver</button>
                <button class="button" type="button" (click)="continueArticleStep()">Continuar con detalles editoriales</button>
              </div>
            </section>

            <section class="editor-stage" *ngIf="activeArticleStep === 'settings'">
              <div class="panel-heading">
                <div>
                  <h3>Detalles editoriales</h3>
                  <p class="panel-subtitle">Ultimos ajustes de clasificacion y estado antes de la revision final.</p>
                </div>
              </div>

              <div class="form-grid">
                <label>
                  <span>Etiquetas</span>
                  <input type="text" [(ngModel)]="articleForm.tags" name="tags" placeholder="memoria, politica, cultura" />
                </label>

                <label>
                  <span>Categoria opcional</span>
                  <select [(ngModel)]="articleForm.categoryId" name="categoryId">
                    <option value="">Sin categoria</option>
                    <option *ngFor="let category of categories" [value]="category.id">{{ category.name }}</option>
                  </select>
                </label>
              </div>

              <div class="form-grid" *ngIf="currentUser.role === 'admin'; else journalistFlowNote">
                <label>
                  <span>Estado</span>
                  <select [(ngModel)]="articleForm.status" name="status">
                    <option value="draft">Borrador</option>
                    <option value="review">En revision</option>
                    <option value="changes_requested">Correcciones</option>
                    <option value="approved">Aprobado</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Archivado</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </label>

                <label class="editor-checkbox">
                  <input type="checkbox" [(ngModel)]="articleForm.featured" name="featured" />
                  <span>Destacar esta pieza en portada</span>
                </label>
              </div>

              <ng-template #journalistFlowNote>
                <div class="editor-note">
                  <strong>Flujo del periodista</strong>
                  <p>Tu nota se mantendra en borrador mientras la editas. En el ultimo paso podras enviarla a revision final.</p>
                </div>
              </ng-template>

              <div class="editor-stage__actions">
                <button class="button button--ghost" type="button" (click)="goToPreviousArticleStep()">Volver</button>
                <button class="button" type="button" (click)="continueArticleStep()">Ir a revision final</button>
              </div>
            </section>

            <section class="editor-stage" *ngIf="activeArticleStep === 'review'">
              <div class="panel-heading">
                <div>
                  <h3>Revision final</h3>
                  <p class="panel-subtitle">Haz un ultimo chequeo antes de guardar o enviar la nota.</p>
                </div>
              </div>

              <div class="editor-review-grid">
                <section class="editor-stage-card">
                  <p class="eyebrow">Titular</p>
                  <strong>{{ articleForm.title.trim() || "Aun sin titulo final" }}</strong>
                  <p>{{ articleForm.subtitle.trim() || "Sin subtitulo por ahora." }}</p>
                </section>

                <section class="editor-stage-card">
                  <p class="eyebrow">Previsualizacion</p>
                  <strong>Resumen corto</strong>
                  <p>{{ articleForm.excerpt.trim() || articlePreviewText() }}</p>
                </section>

                <section class="editor-stage-card">
                  <p class="eyebrow">Cuerpo</p>
                  <strong>{{ contentBlockCount('paragraph') }} parrafos y {{ contentBlockCount('quote') }} citas</strong>
                  <p>{{ contentBlockCount('image') }} fotos y {{ contentBlockCount('embed') }} videos embebidos</p>
                </section>

                <section class="editor-stage-card">
                  <p class="eyebrow">Portada</p>
                  <strong>{{ articleForm.coverUrl ? "Portada lista" : "Sin portada principal" }}</strong>
                  <p>{{ articleForm.coverUrl ? articleForm.coverType : "Puedes dejarla vacia o volver para agregarla." }}</p>
                </section>
              </div>

              <div class="editor-note editor-note--warm" *ngIf="currentUser.role !== 'admin' && !reviewConfirmationOpen">
                <strong>Todo correcto hasta aqui</strong>
                <p>Si quieres revisar una vez mas, vuelve a cualquier paso. Si ya esta lista, puedes enviarla a revision final.</p>
              </div>

              <div class="editor-confirmation" *ngIf="currentUser.role !== 'admin' && reviewConfirmationOpen">
                <strong>Confirmacion editorial</strong>
                <p>La noticia se guardara y se enviara al equipo de moderacion para la revision final. Aun podras verla en el dashboard.</p>
              </div>

              <div class="editor-stage__actions" *ngIf="currentUser.role === 'admin'; else journalistReviewActions">
                <button class="button button--ghost" type="button" (click)="goToPreviousArticleStep()">Volver</button>
                <button
                  class="button"
                  type="button"
                  (click)="saveArticle()"
                  [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()"
                >
                  {{ savingArticle ? "Guardando..." : selectedArticleId ? "Guardar cambios" : "Crear articulo" }}
                </button>
              </div>

              <ng-template #journalistReviewActions>
                <div class="editor-stage__actions" *ngIf="!reviewConfirmationOpen; else journalistConfirmationButtons">
                  <button class="button button--ghost" type="button" (click)="goToPreviousArticleStep()">Volver</button>
                  <button
                    class="button button--secondary"
                    type="button"
                    (click)="saveArticle()"
                    [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()"
                  >
                    {{ savingArticle ? "Guardando..." : selectedArticleId ? "Guardar borrador" : "Crear borrador" }}
                  </button>
                  <button
                    class="button"
                    type="button"
                    (click)="openReviewConfirmation()"
                    [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()"
                  >
                    Todo esta correcto
                  </button>
                </div>

                <ng-template #journalistConfirmationButtons>
                  <div class="editor-stage__actions">
                    <button class="button button--ghost" type="button" (click)="requestLastArticleReview()">Quiero revisar una vez mas</button>
                    <button
                      class="button"
                      type="button"
                      (click)="saveArticle({ submitForReview: true })"
                      [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()"
                    >
                      {{ savingArticle ? "Enviando..." : "Enviar a revision final" }}
                    </button>
                  </div>
                </ng-template>
              </ng-template>
            </section>
          </form>

          <section class="moderation-panel" *ngIf="currentUser.role === 'admin' && selectedArticleId">
            <h3>Moderacion</h3>
            <textarea [(ngModel)]="moderationNote" name="moderationNote" rows="3" placeholder="Nota editorial"></textarea>
            <div class="button-row">
              <button class="button button--secondary" type="button" (click)="moderate('approve')">Aprobar</button>
              <button class="button button--secondary" type="button" (click)="moderate('request_changes')">Pedir cambios</button>
              <button class="button" type="button" (click)="moderate('publish')">Publicar</button>
              <button class="button button--ghost" type="button" (click)="moderate('archive')">Archivar</button>
              <button class="button button--ghost" type="button" (click)="moderate('feature')">Destacar</button>
              <button class="button button--ghost" type="button" (click)="moderate('unfeature')">Quitar destacado</button>
              <button class="button button--ghost" type="button" (click)="moderate('reject')">Rechazar</button>
            </div>
          </section>

          <section class="history-panel" *ngIf="selectedArticle?.moderationHistory?.length">
            <h3>Historial editorial</h3>
            <div class="history-row" *ngFor="let event of selectedArticle?.moderationHistory">
              <strong>{{ formatModerationAction(event.action) }}</strong>
              <span>{{ formatRole(event.role) }} | {{ event.createdAt | date: "short" }}</span>
              <p *ngIf="event.note">{{ event.note }}</p>
            </div>
          </section>
        </section>
      </section>

      <section class="dashboard-columns" *ngIf="activeSection === 'team' && currentUser.role === 'admin'">
        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Equipo editorial</h2>
              <p class="panel-subtitle">Usuarios, roles, accesos y ultimo ingreso.</p>
            </div>
            <span class="count-pill">{{ usersPagination.total }}</span>
          </div>

          <div class="button-row">
            <input
              type="text"
              [(ngModel)]="usersSearch"
              name="usersSearch"
              placeholder="Buscar por nombre o correo"
              (keyup.enter)="applyUsersFilters()"
            />
            <button class="button button--secondary" type="button" (click)="applyUsersFilters()">Buscar</button>
            <button class="button button--ghost" type="button" *ngIf="usersSearch" (click)="clearUsersFilters()">Limpiar</button>
          </div>

          <div class="dashboard-list">
            <button
              type="button"
              class="user-card"
              *ngFor="let user of users"
              [ngClass]="{ 'user-card--active': userForm.id === user.id }"
              (click)="editUser(user)"
            >
              <span class="user-card__avatar">{{ initials(user.name) }}</span>
              <span class="user-card__body">
                <strong>{{ user.name }}</strong>
                <span>{{ formatRole(user.role) }} | {{ formatUserStatus(user.status) }}</span>
                <p>{{ user.email }}</p>
                <small>Ultimo acceso: {{ user.lastLoginAt ? (user.lastLoginAt | date: "short") : "Sin registros" }}</small>
              </span>
            </button>
            <p class="empty-state" *ngIf="users.length === 0">No hay usuarios que coincidan con la busqueda.</p>
          </div>

          <div class="panel-heading" *ngIf="usersPagination.total > 0">
            <div>
              <p class="helper-text">
                Pagina {{ usersPagination.page }} de {{ usersPagination.totalPages }} | {{ usersPagination.total }} usuarios en total
              </p>
            </div>
            <div class="button-row" *ngIf="usersPagination.totalPages > 1">
              <button
                class="button button--ghost"
                type="button"
                (click)="changeUsersPage(usersPagination.page - 1)"
                [disabled]="usersPagination.page <= 1"
              >
                Anterior
              </button>
              <button
                class="button button--ghost"
                type="button"
                (click)="changeUsersPage(usersPagination.page + 1)"
                [disabled]="usersPagination.page >= usersPagination.totalPages"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>{{ userForm.id ? "Editar usuario" : "Crear usuario" }}</h2>
              <p class="panel-subtitle">La contrasena debe tener 10+ caracteres, mayuscula, minuscula, numero y simbolo.</p>
            </div>
            <button class="button button--ghost" type="button" (click)="resetUserForm()">
              {{ userForm.id ? "Nuevo usuario" : "Limpiar" }}
            </button>
          </div>

          <form class="stack-form" (ngSubmit)="saveUser()">
            <input type="text" [(ngModel)]="userForm.name" name="userName" placeholder="Nombre" required />
            <input type="email" [(ngModel)]="userForm.email" name="userEmail" placeholder="Correo" [disabled]="!!userForm.id" required />
            <div class="password-field">
              <input
                [type]="passwordVisibility.user ? 'text' : 'password'"
                [(ngModel)]="userForm.password"
                name="userPassword"
                placeholder="{{ userForm.id ? 'Nueva contrasena opcional' : 'Contrasena segura' }}"
                [required]="!userForm.id"
              />
              <button
                class="password-toggle"
                [class.is-active]="passwordVisibility.user"
                type="button"
                [attr.aria-label]="passwordVisibility.user ? 'Ocultar contrasena' : 'Mostrar contrasena'"
                [attr.aria-pressed]="passwordVisibility.user"
                (click)="togglePasswordVisibility('user')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!passwordVisibility.user; else userPasswordHidden">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <ng-template #userPasswordHidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                    <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                    <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </ng-template>
              </button>
            </div>
            <select [(ngModel)]="userForm.role" name="userRole">
              <option value="journalist">Periodista</option>
              <option value="admin">Administrador</option>
            </select>
            <select [(ngModel)]="userForm.status" name="userStatus">
              <option value="active">Activo</option>
              <option value="blocked">Bloqueado</option>
              <option value="disabled">Inactivo legado</option>
            </select>

            <div class="button-row">
              <button class="button" type="submit">{{ userForm.id ? "Guardar usuario" : "Crear usuario" }}</button>
              <button class="button button--secondary" type="button" (click)="generateUserPassword()">Generar segura</button>
              <button
                class="button button--ghost"
                type="button"
                *ngIf="userForm.id && userForm.id !== currentUser.id"
                (click)="deleteUser()"
              >
                Eliminar usuario
              </button>
            </div>
          </form>
        </section>
      </section>

      <section class="dashboard-columns" *ngIf="activeSection === 'categories' && currentUser.role === 'admin'">
        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Categorias opcionales</h2>
              <p class="panel-subtitle">No son obligatorias en la portada, pero el admin puede ordenarlas aqui.</p>
            </div>
            <button class="button button--ghost" type="button" (click)="resetCategoryForm()">Nueva categoria</button>
          </div>

          <form class="stack-form" (ngSubmit)="saveCategory()">
            <input type="text" [(ngModel)]="categoryForm.name" name="categoryName" placeholder="Nombre" required />
            <textarea [(ngModel)]="categoryForm.description" name="categoryDescription" rows="3" placeholder="Descripcion"></textarea>
            <label><input type="checkbox" [(ngModel)]="categoryForm.isActive" name="categoryIsActive" /> Activa</label>
            <button class="button" type="submit">{{ categoryForm.id ? "Actualizar" : "Crear" }}</button>
          </form>
        </section>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Listado</h2>
              <p class="panel-subtitle">Categorias disponibles para el flujo editorial.</p>
            </div>
            <span class="count-pill">{{ categories.length }}</span>
          </div>

          <div class="dashboard-list">
            <button type="button" class="article-row" *ngFor="let category of categories" (click)="editCategory(category)">
              <strong>{{ category.name }}</strong>
              <span>{{ category.isActive ? "Activa" : "Inactiva" }}</span>
            </button>
            <p class="empty-state" *ngIf="categories.length === 0">No hay categorias creadas.</p>
          </div>
        </section>
      </section>

      <section class="dashboard-columns" *ngIf="activeSection === 'audience' && currentUser.role === 'admin'">
        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Suscripciones</h2>
              <p class="panel-subtitle">Lectores registrados, confirmaciones y estado editorial del boletin.</p>
            </div>
            <span class="count-pill">{{ subscriptionsPagination.total }}</span>
          </div>

          <div class="button-row">
            <input
              type="text"
              [(ngModel)]="subscriptionsSearch"
              name="subscriptionsSearch"
              placeholder="Buscar por nombre, correo o interes"
              (keyup.enter)="applySubscriptionsFilters()"
            />
            <button class="button button--secondary" type="button" (click)="applySubscriptionsFilters()">Buscar</button>
            <button class="button button--ghost" type="button" *ngIf="subscriptionsSearch" (click)="clearSubscriptionsFilters()">Limpiar</button>
          </div>

          <div class="dashboard-list">
            <button
              type="button"
              class="article-row"
              *ngFor="let subscription of subscriptions"
              [class.article-row--active]="selectedSubscriptionId === subscription.id"
              (click)="editSubscription(subscription)"
            >
              <strong>{{ subscription.email }}</strong>
              <span>{{ formatSubscriptionPlan(subscription.plan) }} | {{ subscription.createdAt | date: "shortDate" }}</span>
              <p>{{ formatSubscriptionStatus(subscription.status) }}<span *ngIf="subscription.interests.length"> | {{ formatSubscriptionInterests(subscription.interests) }}</span></p>
            </button>
            <p class="empty-state" *ngIf="subscriptions.length === 0">No hay suscripciones registradas.</p>
          </div>

          <div class="panel-heading" *ngIf="subscriptionsPagination.total > 0">
            <div>
              <p class="helper-text">
                Pagina {{ subscriptionsPagination.page }} de {{ subscriptionsPagination.totalPages }} | {{ subscriptionsPagination.total }} suscripciones en total
              </p>
            </div>
            <div class="button-row" *ngIf="subscriptionsPagination.totalPages > 1">
              <button
                class="button button--ghost"
                type="button"
                (click)="changeSubscriptionsPage(subscriptionsPagination.page - 1)"
                [disabled]="subscriptionsPagination.page <= 1"
              >
                Anterior
              </button>
              <button
                class="button button--ghost"
                type="button"
                (click)="changeSubscriptionsPage(subscriptionsPagination.page + 1)"
                [disabled]="subscriptionsPagination.page >= subscriptionsPagination.totalPages"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>{{ selectedSubscriptionId ? "Moderar suscripcion" : "Moderacion de audiencia" }}</h2>
              <p class="panel-subtitle">Activa, pausa, cancela o elimina registros sin perder visibilidad del historial.</p>
            </div>
            <span class="count-pill">{{ auditEntries.length }}</span>
          </div>

          <div class="stack-form" *ngIf="selectedSubscriptionId; else subscriptionPlaceholder">
            <div class="profile-summary">
              <div class="profile-summary__badge">{{ initials(subscriptionForm.name || subscriptionForm.email) }}</div>
              <div>
                <strong>{{ subscriptionForm.name || "Suscriptor sin nombre" }}</strong>
                <p>{{ subscriptionForm.email }}</p>
                <span>{{ formatSubscriptionPlan(subscriptionForm.plan) }} | {{ formatSubscriptionStatus(subscriptionForm.status) }}</span>
              </div>
            </div>

            <label>
              <span>Estado</span>
              <select [(ngModel)]="subscriptionForm.status" name="subscriptionStatus">
                <option value="pending">Pendiente</option>
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </label>

            <p class="helper-text" *ngIf="subscriptionForm.interests.length">
              Intereses: {{ formatSubscriptionInterests(subscriptionForm.interests) }}
            </p>

            <div class="button-row">
              <button class="button" type="button" (click)="saveSubscription()">Guardar estado</button>
              <button class="button button--ghost" type="button" (click)="deleteSubscription()">Eliminar suscripcion</button>
            </div>
          </div>

          <ng-template #subscriptionPlaceholder>
            <p class="empty-state">Selecciona una suscripcion para moderarla.</p>
          </ng-template>

          <div class="panel-heading">
            <div>
              <h2>Registro de auditoria</h2>
              <p class="panel-subtitle">Trazabilidad de acciones sensibles.</p>
            </div>
          </div>

          <div class="dashboard-list">
            <div class="history-row" *ngFor="let entry of auditEntries">
              <strong>{{ formatAuditAction(entry.action) }}</strong>
              <span>{{ entry.actorEmail || "Sistema" }} | {{ entry.createdAt | date: "short" }}</span>
              <p>{{ formatAuditTargetType(entry.targetType) }} | {{ entry.targetId }}</p>
            </div>
            <p class="empty-state" *ngIf="auditEntries.length === 0">No hay eventos para mostrar.</p>
          </div>
        </section>
      </section>

      <section class="profile-grid" *ngIf="activeSection === 'profile'">
        <section class="dashboard-panel dashboard-panel--accent">
          <div class="panel-heading">
            <div>
              <h2>Tu perfil</h2>
              <p class="panel-subtitle">Informacion de cuenta, rol y seguridad.</p>
            </div>
          </div>

          <div class="profile-summary">
            <div class="profile-summary__badge">{{ initials(currentUser.name) }}</div>
            <div>
              <strong>{{ currentUser.name }}</strong>
              <p>{{ currentUser.email }}</p>
              <span>{{ formatRole(currentUser.role) }} | {{ formatUserStatus(currentUser.status) }}</span>
            </div>
          </div>

          <div class="history-row">
            <strong>Ultimo acceso</strong>
            <span>{{ currentUser.lastLoginAt ? (currentUser.lastLoginAt | date: "short") : "Sin registros" }}</span>
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Editar perfil</h2>
              <p class="panel-subtitle">Actualiza tu nombre visible dentro del medio.</p>
            </div>
          </div>

          <form class="stack-form" (ngSubmit)="saveProfile()">
            <input type="text" [(ngModel)]="profileForm.name" name="profileName" placeholder="Nombre visible" required />
            <button class="button" type="submit">Guardar perfil</button>
          </form>
        </section>

        <section class="dashboard-panel">
          <div class="panel-heading">
            <div>
              <h2>Cambiar contrasena</h2>
              <p class="panel-subtitle">Usa una clave nueva y mas segura.</p>
            </div>
            <button class="button button--ghost" type="button" (click)="generateProfilePassword()">Generar segura</button>
          </div>

          <form class="stack-form" (ngSubmit)="savePassword()">
            <div class="password-field">
              <input
                [type]="passwordVisibility.current ? 'text' : 'password'"
                [(ngModel)]="passwordForm.currentPassword"
                name="currentPassword"
                placeholder="Contrasena actual"
                required
              />
              <button
                class="password-toggle"
                [class.is-active]="passwordVisibility.current"
                type="button"
                [attr.aria-label]="passwordVisibility.current ? 'Ocultar contrasena actual' : 'Mostrar contrasena actual'"
                [attr.aria-pressed]="passwordVisibility.current"
                (click)="togglePasswordVisibility('current')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!passwordVisibility.current; else currentPasswordHidden">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <ng-template #currentPasswordHidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                    <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                    <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </ng-template>
              </button>
            </div>
            <div class="password-field">
              <input
                [type]="passwordVisibility.next ? 'text' : 'password'"
                [(ngModel)]="passwordForm.nextPassword"
                name="nextPassword"
                placeholder="Nueva contrasena"
                required
              />
              <button
                class="password-toggle"
                [class.is-active]="passwordVisibility.next"
                type="button"
                [attr.aria-label]="passwordVisibility.next ? 'Ocultar nueva contrasena' : 'Mostrar nueva contrasena'"
                [attr.aria-pressed]="passwordVisibility.next"
                (click)="togglePasswordVisibility('next')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!passwordVisibility.next; else nextPasswordHidden">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <ng-template #nextPasswordHidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                    <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                    <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </ng-template>
              </button>
            </div>
            <div class="password-field">
              <input
                [type]="passwordVisibility.confirm ? 'text' : 'password'"
                [(ngModel)]="passwordForm.confirmPassword"
                name="confirmPassword"
                placeholder="Confirmar nueva contrasena"
                required
              />
              <button
                class="password-toggle"
                [class.is-active]="passwordVisibility.confirm"
                type="button"
                [attr.aria-label]="passwordVisibility.confirm ? 'Ocultar confirmacion de contrasena' : 'Mostrar confirmacion de contrasena'"
                [attr.aria-pressed]="passwordVisibility.confirm"
                (click)="togglePasswordVisibility('confirm')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" *ngIf="!passwordVisibility.confirm; else confirmPasswordHidden">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <ng-template #confirmPasswordHidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.3A11.5 11.5 0 0 1 12 5.2c6.5 0 10 6.8 10 6.8a19 19 0 0 1-4.1 4.7" />
                    <path d="M6.3 6.6A19.8 19.8 0 0 0 2 12s3.5 6.8 10 6.8a10.8 10.8 0 0 0 4-.7" />
                    <path d="M9.9 9.8a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </ng-template>
              </button>
            </div>
            <button class="button" type="submit">Actualizar contrasena</button>
          </form>
        </section>
      </section>

      <section
        class="dashboard-confirm"
        *ngIf="confirmDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-confirm-title"
        (click)="resolveConfirmation(false)"
      >
        <div class="dashboard-confirm__card" (click)="$event.stopPropagation()" (keydown.escape)="resolveConfirmation(false)" tabindex="0">
          <span class="count-pill count-pill--danger" *ngIf="confirmDialog.tone === 'danger'; else neutralConfirmBadge">Confirmacion</span>
          <ng-template #neutralConfirmBadge>
            <span class="count-pill">Confirmacion</span>
          </ng-template>

          <h2 id="dashboard-confirm-title">{{ confirmDialog.title }}</h2>
          <p class="panel-subtitle">{{ confirmDialog.message }}</p>

          <div class="button-row dashboard-confirm__actions">
            <button class="button button--ghost" type="button" (click)="resolveConfirmation(false)">{{ confirmDialog.cancelLabel }}</button>
            <button
              class="button"
              type="button"
              [ngClass]="{ 'dashboard-confirm__button--danger': confirmDialog.tone === 'danger' }"
              (click)="resolveConfirmation(true)"
            >
              {{ confirmDialog.confirmLabel }}
            </button>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .dashboard-confirm {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        linear-gradient(180deg, rgba(5, 10, 18, 0.5), rgba(5, 10, 18, 0.7)),
        radial-gradient(circle at top, rgba(255, 208, 77, 0.14), transparent 34%);
      backdrop-filter: blur(16px);
    }

    .dashboard-confirm__card {
      width: min(100%, 540px);
      padding: 28px;
      border-radius: 28px;
      border: 1px solid var(--border-strong);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent),
        var(--surface-strong);
      box-shadow: var(--shadow);
      display: grid;
      gap: 16px;
      outline: none;
    }

    .dashboard-confirm__card h2 {
      margin: 0;
      font-family: var(--headline);
      font-size: clamp(1.5rem, 3vw, 2rem);
      color: var(--text);
    }

    .dashboard-confirm__card .panel-subtitle {
      margin: 0;
      font-size: 1rem;
      line-height: 1.7;
    }

    .dashboard-confirm__actions {
      justify-content: flex-end;
    }

    .dashboard-confirm__button--danger {
      background: linear-gradient(135deg, var(--flag-red), var(--flag-yellow));
      color: #101827;
      border-color: rgba(201, 53, 53, 0.26);
      box-shadow: var(--shadow-soft);
    }

    .count-pill--danger {
      color: var(--flag-red);
      border-color: rgba(201, 53, 53, 0.22);
      background: rgba(201, 53, 53, 0.1);
    }

    :host-context(:root[data-theme="dark"]) .dashboard-confirm__button--danger {
      color: #120f0f;
    }

    @media (max-width: 640px) {
      .dashboard-confirm {
        padding: 16px;
        align-items: end;
      }

      .dashboard-confirm__card {
        width: 100%;
        padding: 22px;
        border-radius: 24px 24px 18px 18px;
      }

      .dashboard-confirm__actions {
        width: 100%;
      }

      .dashboard-confirm__actions .button {
        flex: 1 1 0;
        justify-content: center;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  readonly authService = inject(AuthService);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly sections: SectionConfig[] = [
    { id: "overview", label: "Resumen", description: "KPI, actividad y accesos rapidos." },
    { id: "articles", label: "Articulos", description: "Redaccion, revision y moderacion." },
    { id: "team", label: "Equipo", description: "Usuarios, roles y contrasenas.", adminOnly: true },
    { id: "categories", label: "Categorias", description: "Taxonomia opcional del sitio.", adminOnly: true },
    { id: "audience", label: "Audiencia", description: "Suscripciones y auditoria.", adminOnly: true },
    { id: "profile", label: "Perfil", description: "Datos personales y seguridad." }
  ];
  private readonly articleStatusLabels: Record<DashboardArticle["status"], string> = {
    draft: "Borrador",
    review: "En revision",
    changes_requested: "Cambios solicitados",
    approved: "Aprobado",
    published: "Publicado",
    archived: "Archivado",
    rejected: "Rechazado"
  };
  private readonly userStatusLabels: Record<UserSession["status"], string> = {
    active: "Activo",
    blocked: "Bloqueado",
    disabled: "Inactivo"
  };
  private readonly subscriptionStatusLabels: Record<SubscriptionEntry["status"], string> = {
    pending: "Pendiente",
    active: "Activa",
    paused: "Pausada",
    cancelled: "Cancelada"
  };
  private readonly subscriptionPlanLabels: Record<SubscriptionEntry["plan"], string> = {
    newsletter: "Boletin",
    premium: "Acceso premium"
  };
  private readonly moderationActionLabels: Record<string, string> = {
    created: "Creado",
    updated: "Actualizado",
    submitted: "Enviado a revision",
    approved: "Aprobado",
    changes_requested: "Cambios solicitados",
    published: "Publicado",
    archived: "Archivado",
    rejected: "Rechazado",
    featured: "Destacado",
    unfeatured: "Destacado retirado",
    deleted: "Enviado a papelera"
  };
  private readonly auditActionLabels: Record<string, string> = {
    "article.created": "Articulo creado",
    "article.updated": "Articulo actualizado",
    "article.submitted": "Articulo enviado a revision",
    "article.deleted": "Articulo eliminado",
    "article.approve": "Articulo aprobado",
    "article.request_changes": "Cambios solicitados al articulo",
    "article.publish": "Articulo publicado",
    "article.archive": "Articulo archivado",
    "article.reject": "Articulo rechazado",
    "article.feature": "Articulo destacado",
    "article.unfeature": "Destacado retirado del articulo",
    "category.created": "Categoria creada",
    "category.updated": "Categoria actualizada",
    "user.created": "Usuario creado",
    "user.updated": "Usuario actualizado",
    "user.deleted": "Usuario eliminado",
    "profile.updated": "Perfil actualizado",
    "profile.password_changed": "Contrasena actualizada",
    "subscription.updated": "Suscripcion actualizada",
    "subscription.confirmation_requested": "Correo de confirmacion enviado",
    "subscription.activated": "Suscripcion activada",
    "subscription.confirmed": "Suscripcion confirmada",
    "subscription.reactivated": "Suscripcion reactivada",
    "subscription.cancelled": "Suscripcion cancelada",
    "subscription.deleted": "Suscripcion eliminada"
  };
  private readonly auditTargetTypeLabels: Record<string, string> = {
    article: "Articulo",
    category: "Categoria",
    user: "Usuario",
    subscription: "Suscripcion"
  };
  readonly articleSteps: ArticleEditorStepConfig[] = [
    { id: "body", order: 1, label: "Cuerpo", description: "Parrafos, fotos y videos dentro de la noticia." },
    { id: "preview", order: 2, label: "Previsualizacion", description: "Resumen corto y portada principal." },
    { id: "subtitle", order: 3, label: "Subtitulo", description: "Contexto adicional para la lectura." },
    { id: "title", order: 4, label: "Titulo", description: "Titular final con jerarquia editorial." },
    { id: "settings", order: 5, label: "Detalle editorial", description: "Etiquetas, categoria y estado." },
    { id: "review", order: 6, label: "Revision final", description: "Confirmacion antes de publicar o enviar." }
  ];

  activeSection: DashboardSection = "overview";
  activeArticleStep: ArticleEditorStep = "body";
  unlockedArticleStep: ArticleEditorStep = "body";
  loading = true;
  message = "";
  errorMessage = "";
  confirmDialog: ConfirmDialogState | null = null;
  usersSearch = "";
  overview: DashboardOverview | null = null;
  articles: DashboardArticle[] = [];
  articlePagination = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  };
  categories: Category[] = [];
  users: UserSession[] = [];
  usersPagination = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  };
  subscriptions: SubscriptionEntry[] = [];
  subscriptionsPagination = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  };
  auditEntries: AuditEntry[] = [];
  selectedArticle: DashboardArticle | null = null;
  selectedArticleId: string | null = null;
  deletingArticle = false;
  selectedSubscriptionId: string | null = null;
  articleSearch = "";
  articleStatusFilter = "";
  moderationNote = "";
  subscriptionsSearch = "";
  uploadingCover = false;
  savingArticle = false;
  reviewConfirmationOpen = false;
  passwordVisibility: Record<PasswordFieldKey, boolean> = {
    user: false,
    current: false,
    next: false,
    confirm: false
  };

  articleForm: ArticleFormState = this.emptyArticleForm();
  categoryForm = {
    id: "",
    name: "",
    description: "",
    isActive: true
  };
  userForm = {
    id: "",
    name: "",
    email: "",
    password: "",
    role: "journalist" as "admin" | "journalist",
    status: "active" as "active" | "blocked" | "disabled"
  };
  subscriptionForm = {
    id: "",
    name: "",
    email: "",
    plan: "newsletter" as SubscriptionEntry["plan"],
    status: "pending" as SubscriptionEntry["status"],
    interests: [] as string[]
  };
  profileForm = {
    name: ""
  };
  passwordForm = {
    currentPassword: "",
    nextPassword: "",
    confirmPassword: ""
  };
  private confirmDialogResolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    this.seo.setNoIndex("Panel editorial | Colombiano Promedio", "Área privada para redacción, moderación y administración del periódico.");
    this.syncProfileForm();
    void this.loadDashboard();
  }

  visibleSections(currentUser: UserSession): SectionConfig[] {
    return this.sections.filter((section) => !section.adminOnly || currentUser.role === "admin");
  }

  filteredUsers(): UserSession[] {
    return this.users;
  }

  editSubscription(subscription: SubscriptionEntry): void {
    this.selectedSubscriptionId = subscription.id;
    this.subscriptionForm = {
      id: subscription.id,
      name: subscription.name,
      email: subscription.email,
      plan: subscription.plan,
      status: subscription.status,
      interests: [...subscription.interests]
    };
    this.cdr.markForCheck();
  }

  selectSection(section: DashboardSection): void {
    this.activeSection = section;
    this.clearStatus();
    this.cdr.markForCheck();
  }

  startNewArticle(): void {
    this.resetArticleForm();
    this.selectSection("articles");
  }

  openArticleEditor(article: DashboardArticle): void {
    this.editArticle(article);
    this.selectSection("articles");
  }

  canDeleteSelectedArticle(currentUser: UserSession): boolean {
    if (!this.selectedArticle) {
      return false;
    }

    if (currentUser.role === "admin") {
      return true;
    }

    return ["draft", "changes_requested", "rejected"].includes(this.selectedArticle.status);
  }

  initials(name: string): string {
    return name
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  formatRole(role: "admin" | "journalist"): string {
    return role === "admin" ? "Administrador" : "Periodista";
  }

  formatArticleStatus(status: DashboardArticle["status"]): string {
    return this.articleStatusLabels[status] ?? status;
  }

  formatUserStatus(status: UserSession["status"]): string {
    return this.userStatusLabels[status] ?? status;
  }

  formatSubscriptionStatus(status: SubscriptionEntry["status"]): string {
    return this.subscriptionStatusLabels[status] ?? status;
  }

  formatSubscriptionPlan(plan: SubscriptionEntry["plan"]): string {
    return this.subscriptionPlanLabels[plan] ?? plan;
  }

  formatSubscriptionInterests(interests: string[]): string {
    if (interests.length === 0) {
      return "Sin intereses definidos";
    }

    return interests.map((interest) => this.humanizeToken(interest)).join(", ");
  }

  formatModerationAction(action: string): string {
    return this.moderationActionLabels[action] ?? this.humanizeToken(action);
  }

  formatAuditAction(action: string): string {
    return this.auditActionLabels[action] ?? this.humanizeToken(action);
  }

  formatAuditTargetType(targetType: string): string {
    return this.auditTargetTypeLabels[targetType] ?? this.humanizeToken(targetType);
  }

  togglePasswordVisibility(field: PasswordFieldKey): void {
    this.passwordVisibility[field] = !this.passwordVisibility[field];
    this.cdr.markForCheck();
  }

  contentBlockLabel(type: EditorContentBlock["type"]): string {
    if (type === "quote") {
      return "Cita";
    }

    if (type === "image") {
      return "Foto";
    }

    if (type === "embed") {
      return "Video";
    }

    return "Parrafo";
  }

  isVisualCoverType(type: ArticleFormState["coverType"]): boolean {
    return type === "image" || type === "infographic";
  }

  coverObjectPosition(positionX: number, positionY: number): string {
    return `${this.normalizeCoverPosition(positionX)}% ${this.normalizeCoverPosition(positionY)}%`;
  }

  canOpenArticleStep(step: ArticleEditorStep): boolean {
    return this.articleStepIndex(step) <= this.articleStepIndex(this.unlockedArticleStep);
  }

  isArticleStepComplete(step: ArticleEditorStep): boolean {
    return this.articleStepIndex(step) < this.articleStepIndex(this.unlockedArticleStep);
  }

  openArticleStep(step: ArticleEditorStep): void {
    if (!this.canOpenArticleStep(step)) {
      return;
    }

    if (step === "preview" || step === "review") {
      this.hydrateSuggestedPreviewIfNeeded();
    }

    if (step !== "review") {
      this.reviewConfirmationOpen = false;
    }

    this.activeArticleStep = step;
    this.cdr.markForCheck();
  }

  continueArticleStep(): void {
    const validationMessage = this.validateActiveArticleStep();

    if (validationMessage) {
      this.notifyError(new Error(validationMessage), validationMessage);
      this.cdr.markForCheck();
      return;
    }

    const nextStep = this.nextArticleStep(this.activeArticleStep);

    if (!nextStep) {
      return;
    }

    this.unlockedArticleStep = nextStep;
    this.openArticleStep(nextStep);
  }

  goToPreviousArticleStep(): void {
    const previousStep = this.previousArticleStep(this.activeArticleStep);

    if (!previousStep) {
      return;
    }

    this.openArticleStep(previousStep);
  }

  applySuggestedPreview(): void {
    this.articleForm.excerpt = this.articlePreviewText();
    this.cdr.markForCheck();
  }

  articlePreviewText(): string {
    return this.buildExcerptFallback(this.buildContentPayload());
  }

  contentBlockCount(type: EditorContentBlock["type"]): number {
    return this.articleForm.contentBlocks.filter((block) => {
      if (block.type !== type) {
        return false;
      }

      if (type === "paragraph") {
        return block.text.trim().length > 0;
      }

      if (type === "quote") {
        return block.quoteText.trim().length > 0;
      }

      if (type === "image") {
        return block.imageUrl.trim().length > 0;
      }

      return Boolean(resolveVideoEmbed(block.embedUrl));
    }).length;
  }

  openReviewConfirmation(): void {
    const draft = this.composeArticlePayload();
    const validationMessage = this.validateArticlePayload(draft.payload);

    if (validationMessage) {
      this.notifyError(new Error(validationMessage), validationMessage);
      this.cdr.markForCheck();
      return;
    }

    this.reviewConfirmationOpen = true;
    this.cdr.markForCheck();
  }

  requestLastArticleReview(): void {
    this.reviewConfirmationOpen = false;
    this.openArticleStep("body");
  }

  safeEmbedUrl(value: string): SafeResourceUrl | null {
    const resolved = resolveVideoEmbed(value);
    return resolved ? this.sanitizer.bypassSecurityTrustResourceUrl(resolved.embedUrl) : null;
  }

  safeBlockEmbedUrl(block: EditorContentBlock): SafeResourceUrl | null {
    if (block.type !== "embed") {
      return null;
    }

    return this.safeEmbedUrl(block.embedUrl);
  }

  addParagraphBlock(): void {
    this.appendContentBlock("paragraph");
  }

  addQuoteBlock(): void {
    this.appendContentBlock("quote");
  }

  addImageBlock(): void {
    this.appendContentBlock("image");
  }

  addEmbedBlock(): void {
    this.appendContentBlock("embed");
  }

  insertParagraphBlock(afterIndex: number): void {
    this.insertContentBlock(afterIndex, "paragraph");
  }

  insertQuoteBlock(afterIndex: number): void {
    this.insertContentBlock(afterIndex, "quote");
  }

  insertImageBlock(afterIndex: number): void {
    this.insertContentBlock(afterIndex, "image");
  }

  insertEmbedBlock(afterIndex: number): void {
    this.insertContentBlock(afterIndex, "embed");
  }

  removeContentBlock(index: number): void {
    this.articleForm.contentBlocks = this.articleForm.contentBlocks.filter((_, currentIndex) => currentIndex !== index);

    if (this.articleForm.contentBlocks.length === 0) {
      this.articleForm.contentBlocks = [this.createParagraphBlock()];
    }

    this.cdr.markForCheck();
  }

  moveContentBlock(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= this.articleForm.contentBlocks.length) {
      return;
    }

    const items = [...this.articleForm.contentBlocks];
    const [current] = items.splice(index, 1);
    items.splice(nextIndex, 0, current);
    this.articleForm.contentBlocks = items;
    this.cdr.markForCheck();
  }

  private appendContentBlock(type: EditorContentBlock["type"]): void {
    this.insertContentBlock(this.articleForm.contentBlocks.length - 1, type);
  }

  private insertContentBlock(afterIndex: number, type: EditorContentBlock["type"]): void {
    const items = [...this.articleForm.contentBlocks];
    const insertIndex = Math.min(Math.max(afterIndex + 1, 0), items.length);
    items.splice(insertIndex, 0, this.buildContentBlock(type));
    this.articleForm.contentBlocks = items;
    this.cdr.markForCheck();
    this.focusContentBlock(insertIndex);
  }

  private focusContentBlock(index: number): void {
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-content-block-index="${index}"]`) as HTMLElement | null;

      if (!blockElement) {
        return;
      }

      blockElement.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      const field = blockElement.querySelector("textarea, input:not([type='file'])") as HTMLElement | null;
      field?.focus();
    }, 0);
  }

  async onCoverImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    input && (input.value = "");

    if (!file) {
      return;
    }

    try {
      this.uploadingCover = true;
      const uploaded = await this.uploadImageFile(file, this.articleForm.coverAlt);
      this.articleForm.coverUrl = uploaded.url;
      if (!this.articleForm.coverAlt) {
        this.articleForm.coverAlt = uploaded.alt;
      }
      this.notifySuccess("Portada cargada correctamente.");
    } catch (error) {
      this.notifyError(error, "No fue posible subir la portada.");
    } finally {
      this.uploadingCover = false;
      this.cdr.markForCheck();
    }
  }

  async onContentImageSelected(event: Event, index: number): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    input && (input.value = "");

    if (!file) {
      return;
    }

    const block = this.articleForm.contentBlocks[index];

    if (!block || block.type !== "image") {
      return;
    }

    try {
      block.uploading = true;
      this.cdr.markForCheck();

      const uploaded = await this.uploadImageFile(file, block.imageAlt);
      block.imageUrl = uploaded.url;

      if (!block.imageAlt) {
        block.imageAlt = uploaded.alt;
      }

      this.notifySuccess("Imagen del cuerpo cargada correctamente.");
    } catch (error) {
      this.notifyError(error, "No fue posible subir la imagen del cuerpo.");
    } finally {
      block.uploading = false;
      this.cdr.markForCheck();
    }
  }

  private createParagraphBlock(text = ""): EditorContentBlock {
    return {
      type: "paragraph",
      text,
      quoteText: "",
      quoteAttribution: "",
      imageUrl: "",
      imageAlt: "",
      imageCaption: "",
      embedUrl: "",
      embedTitle: "",
      uploading: false
    };
  }

  private createQuoteBlock(quote?: { text?: string; attribution?: string }): EditorContentBlock {
    return {
      type: "quote",
      text: "",
      quoteText: quote?.text ?? "",
      quoteAttribution: quote?.attribution ?? "",
      imageUrl: "",
      imageAlt: "",
      imageCaption: "",
      embedUrl: "",
      embedTitle: "",
      uploading: false
    };
  }

  private createImageBlock(image?: { url?: string; alt?: string; caption?: string }): EditorContentBlock {
    return {
      type: "image",
      text: "",
      quoteText: "",
      quoteAttribution: "",
      imageUrl: image?.url ?? "",
      imageAlt: image?.alt ?? "",
      imageCaption: image?.caption ?? "",
      embedUrl: "",
      embedTitle: "",
      uploading: false
    };
  }

  private createEmbedBlock(embed?: { url?: string; title?: string }): EditorContentBlock {
    return {
      type: "embed",
      text: "",
      quoteText: "",
      quoteAttribution: "",
      imageUrl: "",
      imageAlt: "",
      imageCaption: "",
      embedUrl: embed?.url ?? "",
      embedTitle: embed?.title ?? "",
      uploading: false
    };
  }

  private buildContentBlock(type: EditorContentBlock["type"]): EditorContentBlock {
    if (type === "quote") {
      return this.createQuoteBlock();
    }

    if (type === "image") {
      return this.createImageBlock();
    }

    if (type === "embed") {
      return this.createEmbedBlock();
    }

    return this.createParagraphBlock();
  }

  private mapArticleBlocks(article: DashboardArticle): EditorContentBlock[] {
    const source = Array.isArray(article.contentBlocks) && article.contentBlocks.length > 0
      ? article.contentBlocks
      : article.body.map((text) => ({ type: "paragraph", text } as ArticleContentBlock));

    const blocks = source.map((block) =>
      block.type === "quote"
        ? this.createQuoteBlock(block.quote)
        : block.type === "image"
        ? this.createImageBlock(block.image)
        : block.type === "embed"
          ? this.createEmbedBlock(block.embed)
          : this.createParagraphBlock(block.text)
    );

    return blocks.length > 0 ? blocks : [this.createParagraphBlock()];
  }

  private buildContentPayload(): ArticleContentBlock[] {
    const payload: ArticleContentBlock[] = [];

    for (const block of this.articleForm.contentBlocks) {
      if (block.type === "quote") {
        const text = block.quoteText.trim();

        if (!text) {
          continue;
        }

        payload.push({
          type: "quote",
          quote: {
            text,
            attribution: block.quoteAttribution.trim() || undefined
          }
        });
        continue;
      }

      if (block.type === "image") {
        const imageUrl = block.imageUrl.trim();

        if (!imageUrl) {
          continue;
        }

        payload.push({
          type: "image",
          image: {
            url: imageUrl,
            alt: block.imageAlt.trim(),
            caption: block.imageCaption.trim() || undefined
          }
        });
        continue;
      }

      if (block.type === "embed") {
        const embed = resolveVideoEmbed(block.embedUrl);

        if (!embed) {
          continue;
        }

        payload.push({
          type: "embed",
          embed: {
            url: embed.sourceUrl,
            provider: embed.provider,
            title: block.embedTitle.trim() || undefined
          }
        });
        continue;
      }

      const text = block.text.trim();

      if (!text) {
        continue;
      }

      payload.push({
        type: "paragraph",
        text
      });
    }

    return payload;
  }

  hasUploadingContentBlocks(): boolean {
    return this.articleForm.contentBlocks.some((block) => block.uploading);
  }

  private buildExcerptFallback(contentBlocks: ArticleContentBlock[]): string {
    const explicitExcerpt = this.articleForm.excerpt.trim().replace(/\s+/g, " ");

    if (explicitExcerpt.length >= 20) {
      return explicitExcerpt.slice(0, 320);
    }

    let firstParagraph = "";

    for (const block of contentBlocks) {
      if (block.type === "paragraph" && "text" in block) {
        const text = block.text.trim().replace(/\s+/g, " ");

        if (text) {
          firstParagraph = text;
          break;
        }
      }

      if (block.type === "quote" && "quote" in block) {
        const text = block.quote.text.trim().replace(/\s+/g, " ");

        if (text) {
          firstParagraph = text;
          break;
        }
      }
    }

    const composite = [firstParagraph, this.articleForm.subtitle.trim(), this.articleForm.title.trim()]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (composite.length >= 20) {
      return composite.slice(0, 320);
    }

    return `${this.articleForm.title.trim()} Cobertura editorial en desarrollo.`.replace(/\s+/g, " ").trim().slice(0, 320);
  }

  private composeArticlePayload(): {
    excerpt: string;
    payload: {
      title: string;
      subtitle: string;
      excerpt: string;
      contentBlocks: ArticleContentBlock[];
      cover: {
        url: string;
        alt: string;
        positionX: number;
        positionY: number;
        type: ArticleFormState["coverType"];
      };
      categoryId: string | null;
      tags: string[];
      isPremium: boolean;
      featured: boolean;
      status: ArticleFormState["status"];
    };
  } {
    const contentBlocks = this.buildContentPayload();
    const excerpt = this.buildExcerptFallback(contentBlocks);

    return {
      excerpt,
      payload: {
        title: this.articleForm.title.trim(),
        subtitle: this.articleForm.subtitle.trim(),
        excerpt,
        contentBlocks,
        cover: {
          url: this.articleForm.coverUrl.trim(),
          alt: this.articleForm.coverAlt.trim(),
          positionX: this.normalizeCoverPosition(this.articleForm.coverPositionX),
          positionY: this.normalizeCoverPosition(this.articleForm.coverPositionY),
          type: this.articleForm.coverType
        },
        categoryId: this.articleForm.categoryId || null,
        tags: this.articleForm.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        isPremium: false,
        featured: this.articleForm.featured,
        status: this.articleForm.status
      }
    };
  }

  private validateArticlePayload(payload: {
    title: string;
    excerpt: string;
    contentBlocks: ArticleContentBlock[];
  }): string | null {
    if (this.uploadingCover || this.hasUploadingContentBlocks()) {
      return "Espera a que terminen de subir todas las imagenes antes de guardar el articulo.";
    }

    if (payload.title.trim().length < 6) {
      return "El titulo debe tener al menos 6 caracteres.";
    }

    if (payload.contentBlocks.length === 0) {
      return "Agrega al menos un parrafo, una cita, una foto o un video embebido al cuerpo del articulo.";
    }

    if (payload.excerpt.trim().length < 20) {
      return "La previsualizacion corta debe tener al menos 20 caracteres o suficiente contexto en el cuerpo para generarla.";
    }

    return null;
  }

  private articleStepIndex(step: ArticleEditorStep): number {
    return this.articleSteps.findIndex((item) => item.id === step);
  }

  private nextArticleStep(step: ArticleEditorStep): ArticleEditorStep | null {
    const currentIndex = this.articleStepIndex(step);
    return this.articleSteps[currentIndex + 1]?.id ?? null;
  }

  private previousArticleStep(step: ArticleEditorStep): ArticleEditorStep | null {
    const currentIndex = this.articleStepIndex(step);
    return this.articleSteps[currentIndex - 1]?.id ?? null;
  }

  private normalizeCoverPosition(value: number): number {
    if (!Number.isFinite(Number(value))) {
      return 50;
    }

    return Math.min(100, Math.max(0, Math.round(Number(value) * 10) / 10));
  }

  private humanizeToken(value: string): string {
    return value
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part, index) => {
        const normalized = part.toLowerCase();

        switch (normalized) {
          case "article":
            return index === 0 ? "Articulo" : "articulo";
          case "profile":
            return index === 0 ? "Perfil" : "perfil";
          case "user":
            return index === 0 ? "Usuario" : "usuario";
          case "subscription":
            return index === 0 ? "Suscripcion" : "suscripcion";
          case "category":
            return index === 0 ? "Categoria" : "categoria";
          case "created":
            return "creado";
          case "updated":
            return "actualizado";
          case "submitted":
            return "enviado";
          case "approved":
            return "aprobado";
          case "published":
            return "publicado";
          case "archived":
            return "archivado";
          case "rejected":
            return "rechazado";
          case "feature":
          case "featured":
            return "destacado";
          case "unfeature":
          case "unfeatured":
            return "sin destaque";
          case "request":
          case "requested":
            return "solicitados";
          case "changes":
            return "cambios";
          case "confirmation":
            return "confirmacion";
          case "password":
            return "contrasena";
          case "changed":
            return "actualizada";
          default:
            return index === 0 ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : normalized;
        }
      })
      .join(" ");
  }

  private validateActiveArticleStep(): string | null {
    if (this.activeArticleStep === "body") {
      if (this.hasUploadingContentBlocks()) {
        return "Espera a que terminen de subir las imagenes del cuerpo antes de continuar.";
      }

      if (this.buildContentPayload().length === 0) {
        return "Agrega al menos un parrafo, una cita, una foto o un video embebido para empezar la noticia.";
      }

      return null;
    }

    if (this.activeArticleStep === "preview") {
      if (this.uploadingCover) {
        return "Espera a que termine de subir la portada antes de continuar.";
      }

      const previewText = this.articlePreviewText();

      if (previewText.trim().length < 20) {
        return "La previsualizacion corta aun no tiene suficiente contexto. Ajusta el resumen o agrega mas contenido.";
      }

      this.articleForm.excerpt = previewText;
      return null;
    }

    if (this.activeArticleStep === "title") {
      if (this.articleForm.title.trim().length < 6) {
        return "Antes de continuar, escribe un titulo con al menos 6 caracteres.";
      }
    }

    if (this.activeArticleStep === "settings" && this.uploadingCover) {
      return "Espera a que termine de subir la portada antes de ir a la revision final.";
    }

    return null;
  }

  private hydrateSuggestedPreviewIfNeeded(): void {
    if (this.articleForm.excerpt.trim().length >= 20) {
      return;
    }

    this.articleForm.excerpt = this.articlePreviewText();
  }

  insertSmartQuotes(index: number): void {
    this.insertTextIntoParagraph(index, "“Texto citado”", "“", "”");
  }

  insertLinkTemplate(index: number): void {
    this.insertTextIntoParagraph(index, "[texto del enlace](https://ejemplo.com)", "[", "](https://ejemplo.com)");
  }

  private insertTextIntoParagraph(index: number, placeholder: string, prefix = "", suffix = ""): void {
    const block = this.articleForm.contentBlocks[index];

    if (!block || block.type !== "paragraph") {
      return;
    }

    const elementId = `editorBlockText${index}`;
    const textarea = document.getElementById(elementId) as HTMLTextAreaElement | null;
    const currentValue = block.text ?? "";

    if (!textarea) {
      block.text = currentValue ? `${currentValue}\n${placeholder}` : placeholder;
      this.cdr.markForCheck();
      return;
    }

    const selectionStart = textarea.selectionStart ?? currentValue.length;
    const selectionEnd = textarea.selectionEnd ?? currentValue.length;
    const selectedText = currentValue.slice(selectionStart, selectionEnd);
    const insertion = selectedText ? `${prefix}${selectedText}${suffix}` : placeholder;

    block.text = `${currentValue.slice(0, selectionStart)}${insertion}${currentValue.slice(selectionEnd)}`;
    this.cdr.markForCheck();

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPosition = selectionStart + insertion.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  private validateImageFile(file: File): void {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

    if (!allowedTypes.has(file.type)) {
      throw new Error("Solo puedes cargar imagenes PNG, JPG, WEBP, GIF o AVIF.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("La imagen supera el limite permitido de 5 MB.");
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

  private async uploadImageFile(file: File, alt: string): Promise<{ url: string; alt: string; filename: string }> {
    this.validateImageFile(file);

    const dataUrl = await this.readFileAsDataUrl(file);

    return this.dashboardApi.uploadArticleImage({
      dataUrl,
      filename: file.name,
      alt
    });
  }

  private emptyArticleForm(): ArticleFormState {
    return {
      title: "",
      subtitle: "",
      excerpt: "",
      coverUrl: "",
      coverAlt: "",
      coverPositionX: 50,
      coverPositionY: 50,
      coverType: "image",
      categoryId: "",
      tags: "",
      isPremium: false,
      featured: false,
      status: "draft",
      contentBlocks: [this.createParagraphBlock()]
    };
  }

  private resetSubscriptionForm(): void {
    this.selectedSubscriptionId = null;
    this.subscriptionForm = {
      id: "",
      name: "",
      email: "",
      plan: "newsletter",
      status: "pending",
      interests: []
    };
  }

  private syncProfileForm(): void {
    const currentUser = this.authService.user();
    this.profileForm.name = currentUser?.name ?? "";
  }

  private resetPasswordForm(): void {
    this.passwordForm = {
      currentPassword: "",
      nextPassword: "",
      confirmPassword: ""
    };
    this.passwordVisibility.current = false;
    this.passwordVisibility.next = false;
    this.passwordVisibility.confirm = false;
  }

  private buildStrongPassword(): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%^&*?";
    const pool = upper + lower + digits + symbols;
    let password = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ].join("");

    while (password.length < 14) {
      password += pool[Math.floor(Math.random() * pool.length)];
    }

    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  generateUserPassword(): void {
    this.userForm.password = this.buildStrongPassword();
    this.notifySuccess("Contrasena segura generada para el formulario de usuario.");
    this.cdr.markForCheck();
  }

  generateProfilePassword(): void {
    const password = this.buildStrongPassword();
    this.passwordForm.nextPassword = password;
    this.passwordForm.confirmPassword = password;
    this.notifySuccess("Contrasena segura generada para tu perfil. Revisa la actual antes de guardar.");
    this.cdr.markForCheck();
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

  private clearStatus(): void {
    this.message = "";
    this.errorMessage = "";
  }

  private notifySuccess(message: string): void {
    this.message = message;
    this.errorMessage = "";
    this.toast.success(message);
  }

  private notifyError(error: unknown, fallback: string): string {
    const message = this.readError(error, fallback);
    this.errorMessage = message;
    this.message = "";
    this.toast.error(message);
    return message;
  }

  private requestConfirmation(dialog: ConfirmDialogState): Promise<boolean> {
    this.confirmDialogResolver?.(false);
    this.confirmDialog = dialog;
    this.cdr.markForCheck();

    return new Promise((resolve) => {
      this.confirmDialogResolver = resolve;
    });
  }

  resolveConfirmation(confirmed: boolean): void {
    const resolver = this.confirmDialogResolver;
    this.confirmDialogResolver = null;
    this.confirmDialog = null;
    resolver?.(confirmed);
    this.cdr.markForCheck();
  }

  async loadDashboard(): Promise<void> {
    this.loading = true;
    this.errorMessage = "";

    try {
      const overview = await this.dashboardApi.getOverview();
      this.overview = overview;
      await this.loadArticles();
      this.categories = await this.dashboardApi.getCategories();

      if (this.authService.isAdmin()) {
        const [auditEntries] = await Promise.all([
          this.dashboardApi.getAuditLogs(),
          this.loadUsersPage(this.usersPagination.page),
          this.loadSubscriptionsPage(this.subscriptionsPagination.page)
        ]);

        this.auditEntries = auditEntries;
      }

      this.syncProfileForm();
    } catch (error) {
      this.notifyError(error, "No fue posible cargar el dashboard.");
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadArticles(): Promise<void> {
    await this.loadArticlesPage(this.articlePagination.page);
  }

  applyArticleFilters(): void {
    void this.loadArticlesPage(1);
  }

  changeArticlePage(page: number): void {
    if (page < 1 || page > this.articlePagination.totalPages || page === this.articlePagination.page) {
      return;
    }

    void this.loadArticlesPage(page);
  }

  async loadArticlesPage(page: number): Promise<void> {
    try {
      const response = await this.dashboardApi.getArticles({
        search: this.articleSearch,
        status: this.articleStatusFilter,
        page,
        limit: this.articlePagination.limit
      });

      if (response.pagination.totalPages > 0 && page > response.pagination.totalPages) {
        await this.loadArticlesPage(response.pagination.totalPages);
        return;
      }

      this.articles = response.items;
      this.articlePagination = {
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: Math.max(response.pagination.totalPages, 1)
      };

      if (this.selectedArticleId) {
        const current = this.articles.find((article) => article.id === this.selectedArticleId);
        this.selectedArticle = current ?? this.selectedArticle;
      }
    } catch (error) {
      this.notifyError(error, "No fue posible cargar los articulos.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  applyUsersFilters(): void {
    void this.loadUsersPage(1);
  }

  clearUsersFilters(): void {
    if (!this.usersSearch) {
      return;
    }

    this.usersSearch = "";
    void this.loadUsersPage(1);
  }

  changeUsersPage(page: number): void {
    if (page < 1 || page > this.usersPagination.totalPages || page === this.usersPagination.page) {
      return;
    }

    void this.loadUsersPage(page);
  }

  async loadUsersPage(page: number): Promise<void> {
    try {
      const response = await this.dashboardApi.getUsers({
        search: this.usersSearch,
        page,
        limit: this.usersPagination.limit
      });

      if (response.pagination.totalPages > 0 && page > response.pagination.totalPages) {
        await this.loadUsersPage(response.pagination.totalPages);
        return;
      }

      this.users = response.items;
      this.usersPagination = {
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: Math.max(response.pagination.totalPages, 1)
      };
    } catch (error) {
      this.notifyError(error, "No fue posible cargar los usuarios.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  applySubscriptionsFilters(): void {
    void this.loadSubscriptionsPage(1);
  }

  clearSubscriptionsFilters(): void {
    if (!this.subscriptionsSearch) {
      return;
    }

    this.subscriptionsSearch = "";
    void this.loadSubscriptionsPage(1);
  }

  changeSubscriptionsPage(page: number): void {
    if (page < 1 || page > this.subscriptionsPagination.totalPages || page === this.subscriptionsPagination.page) {
      return;
    }

    void this.loadSubscriptionsPage(page);
  }

  async loadSubscriptionsPage(page: number): Promise<void> {
    try {
      const response = await this.dashboardApi.getSubscriptions({
        search: this.subscriptionsSearch,
        page,
        limit: this.subscriptionsPagination.limit
      });

      if (response.pagination.totalPages > 0 && page > response.pagination.totalPages) {
        await this.loadSubscriptionsPage(response.pagination.totalPages);
        return;
      }

      this.subscriptions = response.items;
      this.subscriptionsPagination = {
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: Math.max(response.pagination.totalPages, 1)
      };

      if (this.selectedSubscriptionId) {
        const currentSubscription = this.subscriptions.find((subscription) => subscription.id === this.selectedSubscriptionId);

        if (currentSubscription) {
          this.editSubscription(currentSubscription);
        } else {
          this.resetSubscriptionForm();
        }
      }
    } catch (error) {
      this.notifyError(error, "No fue posible cargar las suscripciones.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  editArticle(article: DashboardArticle): void {
    this.selectedArticleId = article.id;
    this.selectedArticle = article;
    this.moderationNote = article.moderationNote ?? "";
    this.reviewConfirmationOpen = false;
    this.articleForm = {
      title: article.title,
      subtitle: article.subtitle,
      excerpt: article.excerpt,
      coverUrl: article.cover.url,
      coverAlt: article.cover.alt,
      coverPositionX: this.normalizeCoverPosition(article.cover.positionX),
      coverPositionY: this.normalizeCoverPosition(article.cover.positionY),
      coverType: article.cover.type,
      categoryId: article.category?.id ?? "",
      tags: article.tags.join(", "),
      isPremium: false,
      featured: article.featured,
      status: article.status,
      contentBlocks: this.mapArticleBlocks(article)
    };
    this.unlockedArticleStep = "review";
    this.activeArticleStep = "review";
    this.cdr.markForCheck();
  }

  resetArticleForm(): void {
    this.selectedArticleId = null;
    this.selectedArticle = null;
    this.moderationNote = "";
    this.uploadingCover = false;
    this.reviewConfirmationOpen = false;
    this.articleForm = this.emptyArticleForm();
    this.unlockedArticleStep = "body";
    this.activeArticleStep = "body";
    this.cdr.markForCheck();
  }

  async saveArticle(options: { submitForReview?: boolean } = {}): Promise<void> {
    this.clearStatus();

    const draft = this.composeArticlePayload();
    const validationMessage = this.validateArticlePayload(draft.payload);

    if (validationMessage) {
      this.notifyError(new Error(validationMessage), validationMessage);
      this.cdr.markForCheck();
      return;
    }

    try {
      this.savingArticle = true;
      this.articleForm.excerpt = draft.excerpt;
      const article = this.selectedArticleId
        ? await this.dashboardApi.updateArticle(this.selectedArticleId, draft.payload)
        : await this.dashboardApi.createArticle(draft.payload);

      if (options.submitForReview && !this.authService.isAdmin()) {
        await this.dashboardApi.submitArticle(article.id);
      }

      this.reviewConfirmationOpen = false;
      this.notifySuccess(
        options.submitForReview && !this.authService.isAdmin()
          ? (this.selectedArticleId ? "Articulo actualizado y enviado a revision final." : "Articulo creado y enviado a revision final.")
          : (this.selectedArticleId ? "Articulo actualizado." : "Articulo creado.")
      );
      await this.loadDashboard();
      const refreshed = this.articles.find((item) => item.id === article.id);
      this.editArticle(refreshed ?? article);
    } catch (error) {
      this.notifyError(error, "No fue posible guardar el articulo.");
    }
    finally {
      this.savingArticle = false;
      this.cdr.markForCheck();
    }
  }

  async submitForReview(): Promise<void> {
    if (!this.selectedArticleId) {
      return;
    }

    try {
      await this.dashboardApi.submitArticle(this.selectedArticleId);
      this.notifySuccess("Articulo enviado a revision.");
      await this.loadDashboard();
    } catch (error) {
      this.notifyError(error, "No fue posible enviar el articulo a revision.");
      this.cdr.markForCheck();
    }
  }

  async moderate(action: string): Promise<void> {
    if (!this.selectedArticleId) {
      return;
    }

    try {
      const updated = await this.dashboardApi.moderateArticle(this.selectedArticleId, action, this.moderationNote);
      this.notifySuccess(`Accion aplicada: ${action}.`);
      await this.loadDashboard();
      this.editArticle(updated);
    } catch (error) {
      this.notifyError(error, "No fue posible aplicar la moderacion.");
      this.cdr.markForCheck();
    }
  }

  async deleteArticle(): Promise<void> {
    if (!this.selectedArticleId || !this.selectedArticle || this.deletingArticle) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Enviar articulo a papelera",
      message: `El articulo "${this.selectedArticle.title}" se enviara a la papelera editorial y dejara de mostrarse al publico.`,
      confirmLabel: "Enviar a papelera",
      cancelLabel: "Seguir editando",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }

    this.clearStatus();
    this.deletingArticle = true;

    try {
      const articleId = this.selectedArticleId;
      const response = await this.dashboardApi.deleteArticle(articleId);
      this.resetArticleForm();
      await this.loadDashboard();
      this.notifySuccess(response.message);
    } catch (error) {
      this.notifyError(error, "No fue posible eliminar el articulo.");
    } finally {
      this.deletingArticle = false;
      this.cdr.markForCheck();
    }
  }

  editCategory(category: Category): void {
    this.categoryForm = {
      id: category.id,
      name: category.name,
      description: category.description,
      isActive: category.isActive
    };
    this.cdr.markForCheck();
  }

  resetCategoryForm(): void {
    this.categoryForm = {
      id: "",
      name: "",
      description: "",
      isActive: true
    };
    this.cdr.markForCheck();
  }

  async saveCategory(): Promise<void> {
    try {
      if (this.categoryForm.id) {
        await this.dashboardApi.updateCategory(this.categoryForm.id, this.categoryForm);
      } else {
        await this.dashboardApi.createCategory(this.categoryForm);
      }

      this.resetCategoryForm();
      this.categories = await this.dashboardApi.getCategories();
      this.overview = await this.dashboardApi.getOverview();
      this.notifySuccess("Categoria guardada.");
    } catch (error) {
      this.notifyError(error, "No fue posible guardar la categoria.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  editUser(user: UserSession): void {
    this.userForm = {
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status === "disabled" ? "disabled" : user.status
    };
    this.passwordVisibility.user = false;
    this.cdr.markForCheck();
  }

  resetUserForm(): void {
    this.userForm = {
      id: "",
      name: "",
      email: "",
      password: "",
      role: "journalist",
      status: "active"
    };
    this.passwordVisibility.user = false;
    this.cdr.markForCheck();
  }

  async saveUser(): Promise<void> {
    this.clearStatus();

    try {
      if (this.userForm.id) {
        await this.dashboardApi.updateUser(this.userForm.id, {
          name: this.userForm.name,
          password: this.userForm.password || undefined,
          role: this.userForm.role,
          status: this.userForm.status
        });
      } else {
        await this.dashboardApi.createUser(this.userForm);
      }

      this.resetUserForm();
      await this.loadDashboard();
      this.notifySuccess("Usuario guardado.");
    } catch (error) {
      this.notifyError(error, "No fue posible guardar el usuario.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  async deleteUser(): Promise<void> {
    if (!this.userForm.id) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Eliminar usuario editorial",
      message: `Se eliminara el usuario ${this.userForm.email}. Esta accion no se puede deshacer.`,
      confirmLabel: "Eliminar usuario",
      cancelLabel: "Cancelar",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }

    this.clearStatus();

    try {
      const response = await this.dashboardApi.deleteUser(this.userForm.id);
      this.resetUserForm();
      await this.loadDashboard();
      this.notifySuccess(response.message);
    } catch (error) {
      this.notifyError(error, "No fue posible eliminar el usuario.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  async saveSubscription(): Promise<void> {
    if (!this.subscriptionForm.id) {
      return;
    }

    this.clearStatus();

    try {
      const updated = await this.dashboardApi.updateSubscription(this.subscriptionForm.id, {
        status: this.subscriptionForm.status
      });

      this.notifySuccess("Suscripcion actualizada.");
      await this.loadDashboard();
      this.editSubscription(updated);
    } catch (error) {
      this.notifyError(error, "No fue posible actualizar la suscripcion.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  async deleteSubscription(): Promise<void> {
    if (!this.subscriptionForm.id) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Eliminar suscripcion",
      message: `Se eliminara la suscripcion de ${this.subscriptionForm.email}. Esta accion no se puede deshacer.`,
      confirmLabel: "Eliminar suscripcion",
      cancelLabel: "Cancelar",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }

    this.clearStatus();

    try {
      const response = await this.dashboardApi.deleteSubscription(this.subscriptionForm.id);
      this.resetSubscriptionForm();
      await this.loadDashboard();
      this.notifySuccess(response.message);
    } catch (error) {
      this.notifyError(error, "No fue posible eliminar la suscripcion.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  async saveProfile(): Promise<void> {
    this.clearStatus();

    try {
      const response = await this.dashboardApi.updateProfile(this.profileForm);
      this.authService.applyUser(response.user);
      this.syncProfileForm();
      this.notifySuccess("Perfil actualizado.");
    } catch (error) {
      this.notifyError(error, "No fue posible actualizar el perfil.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  async savePassword(): Promise<void> {
    this.clearStatus();

    try {
      const response = await this.dashboardApi.changePassword(this.passwordForm);
      this.resetPasswordForm();
      this.notifySuccess(response.message);
    } catch (error) {
      this.notifyError(error, "No fue posible actualizar la contrasena.");
    } finally {
      this.cdr.markForCheck();
    }
  }
}


