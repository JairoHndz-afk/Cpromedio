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
import { renderEditorialText } from "../../core/utils/editorial-rich-text";
import { isInstagramEmbed, isTweetEmbed, resolveInstagramEmbedSource, resolveTweetEmbedSource, resolveVideoEmbed } from "../../core/utils/video-embed";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import {
  AutoImage,
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Image,
  ImageCaption,
  ImageInsert,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  MediaEmbed,
  Paragraph,
  PasteFromOffice,
  Strikethrough,
  Underline
} from "ckeditor5";
import esTranslations from "ckeditor5/translations/es.js";

type DashboardSection = "overview" | "articles" | "team" | "categories" | "audience" | "profile";
type OverviewPanel = "recent" | "top" | "account";
type ArticleWorkspaceTab = "redaction" | "format" | "media" | "preview" | "publish";
type ArticleEditorStep = "body" | "preview" | "subtitle" | "title" | "settings" | "review";
type EditorPreviewMode = "article" | "home" | "mobile" | "share";
type EditorSidebarTab = "document" | "block";
type BlockTextField = "headingText" | "text" | "quoteText";
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

interface ArticleWorkspaceTabConfig {
  id: ArticleWorkspaceTab;
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
  headingText: string;
  headingAlign: "left" | "center" | "right";
  headingLevel: "h2" | "h3";
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

interface BlockCursorState {
  index: number;
  field: BlockTextField;
  start: number;
  end: number;
}

interface CkeditorFileLoader {
  file: Promise<File>;
}

interface CkeditorUploadAdapterConsumer {
  plugins: {
    get: (name: string) => {
      createUploadAdapter?: (loader: CkeditorFileLoader) => EditorialImageUploadAdapter;
    };
  };
}

class EditorialImageUploadAdapter {
  private aborted = false;

  constructor(
    private readonly loader: CkeditorFileLoader,
    private readonly uploadFile: (file: File) => Promise<{ url: string }>
  ) {}

  async upload(): Promise<{ default: string }> {
    const file = await this.loader.file;

    if (this.aborted) {
      throw new Error("La carga fue cancelada.");
    }

    const uploaded = await this.uploadFile(file);

    if (this.aborted) {
      throw new Error("La carga fue cancelada.");
    }

    return {
      default: uploaded.url
    };
  }

  abort(): void {
    this.aborted = true;
  }
}

function createEditorialUploadAdapterPlugin(
  factory: (file: File) => Promise<{ url: string }>
): (editor: CkeditorUploadAdapterConsumer) => void {
  return function editorialUploadAdapterPlugin(editor: CkeditorUploadAdapterConsumer): void {
    const repository = editor.plugins.get("FileRepository");
    repository.createUploadAdapter = (loader: CkeditorFileLoader) =>
      new EditorialImageUploadAdapter(loader, factory);
  };
}

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, DatePipe, CKEditorModule],
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

      <section class="dashboard-overview dashboard-overview--focused" *ngIf="activeSection === 'overview'">
        <section class="dashboard-panel dashboard-panel--accent dashboard-overview__hero">
          <div class="dashboard-overview__hero-copy">
            <p class="eyebrow">Vista rapida</p>
            <h2>Menos ruido, mas foco editorial.</h2>
            <p class="panel-subtitle">Consulta el pulso del medio y abre solo el bloque que necesitas en cada momento.</p>
          </div>

          <div class="dashboard-overview__chips" *ngIf="overview">
            <span class="count-pill" *ngIf="currentUser.role === 'admin'">{{ overview.metrics.usersCount }} usuarios</span>
            <span class="count-pill" *ngIf="currentUser.role === 'admin'">{{ overview.metrics.subscriptionsCount }} suscripciones</span>
            <span class="count-pill">{{ overview.metrics.reviewCount }} pendientes</span>
          </div>

          <div class="button-row">
            <button class="button button--secondary" type="button" (click)="selectSection('articles')">Ir a articulos</button>
            <button class="button button--ghost" type="button" (click)="selectSection('profile')">Abrir perfil</button>
            <button class="button button--ghost" type="button" *ngIf="currentUser.role === 'admin'" (click)="selectSection('team')">
              Gestionar equipo
            </button>
          </div>
        </section>

        <section class="dashboard-panel dashboard-overview__spotlight">
          <div class="panel-heading panel-heading--overview">
            <div>
              <h2>{{ overviewPanelTitle() }}</h2>
              <p class="panel-subtitle">{{ overviewPanelSubtitle() }}</p>
            </div>

            <div class="dashboard-overview__switcher" aria-label="Cambiar vista rapida">
              <button
                type="button"
                class="dashboard-overview__switch"
                [ngClass]="{ 'is-active': activeOverviewPanel === 'recent' }"
                (click)="setActiveOverviewPanel('recent')"
              >
                Actividad
              </button>
              <button
                type="button"
                class="dashboard-overview__switch"
                [ngClass]="{ 'is-active': activeOverviewPanel === 'top' }"
                (click)="setActiveOverviewPanel('top')"
              >
                Mas vistos
              </button>
              <button
                type="button"
                class="dashboard-overview__switch"
                [ngClass]="{ 'is-active': activeOverviewPanel === 'account' }"
                (click)="setActiveOverviewPanel('account')"
              >
                Cuenta
              </button>
            </div>
          </div>

          <div class="dashboard-list dashboard-overview__list" *ngIf="activeOverviewPanel === 'recent'">
            <button
              type="button"
              class="article-row"
              *ngFor="let article of overviewRecentArticles()"
              (click)="openArticleEditor(article)"
            >
              <strong>{{ article.title }}</strong>
              <span>{{ formatArticleStatus(article.status) }} | {{ article.author?.name || "Redaccion" }}</span>
            </button>
            <p class="empty-state" *ngIf="overviewRecentArticles().length === 0">Todavia no hay actividad editorial.</p>
          </div>

          <div class="dashboard-list dashboard-overview__list" *ngIf="activeOverviewPanel === 'top'">
            <div class="history-row" *ngFor="let article of overviewTopViewedArticles()">
              <strong>{{ article.title }}</strong>
              <span>{{ article.metrics.views }} vistas | {{ formatArticleStatus(article.status) }}</span>
              <p>{{ article.author?.name || "Redaccion" }}</p>
            </div>
            <p class="empty-state" *ngIf="overviewTopViewedArticles().length === 0">Aun no hay suficientes vistas para mostrar tendencia.</p>
          </div>

          <div class="dashboard-overview__account" *ngIf="activeOverviewPanel === 'account'">
            <div class="dashboard-overview__account-grid">
              <div class="profile-summary">
                <div class="profile-summary__badge">{{ initials(currentUser.name) }}</div>
                <div>
                  <strong>{{ currentUser.name }}</strong>
                  <p>{{ currentUser.email }}</p>
                  <span>{{ formatRole(currentUser.role) }} | {{ formatUserStatus(currentUser.status) }}</span>
                </div>
              </div>

              <div class="dashboard-overview__account-cards">
                <article class="dashboard-overview__mini">
                  <strong>Ultimo acceso</strong>
                  <span>{{ currentUser.lastLoginAt ? (currentUser.lastLoginAt | date: "short") : "Sin registros" }}</span>
                </article>
                <article class="dashboard-overview__mini">
                  <strong>Publicaciones activas</strong>
                  <span>{{ overview?.metrics?.publishedCount ?? 0 }} piezas visibles para lectores.</span>
                </article>
              </div>
            </div>

            <div class="button-row">
              <button class="button" type="button" (click)="selectSection('profile')">Editar perfil</button>
              <button class="button button--secondary" type="button" (click)="selectSection('articles')">Redactar</button>
            </div>
          </div>
        </section>
      </section>

      <section class="dashboard-grid dashboard-grid--editor" *ngIf="activeSection === 'articles'">
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

          <div class="doc-editor">
            <div class="doc-editor__menu">
              <button
                type="button"
                class="doc-editor__menu-tab"
                *ngFor="let tab of articleWorkspaceTabs"
                [ngClass]="{ 'is-active': activeArticleWorkspaceTab === tab.id }"
                (click)="setActiveArticleWorkspaceTab(tab.id)"
              >
                <span>{{ tab.label }}</span>
                <small>{{ tab.description }}</small>
              </button>
            </div>

            <div class="doc-editor__toolbar" role="toolbar" aria-label="Estado del editor">
              <div class="doc-editor__toolbar-group">
                <span class="helper-text">
                  Escribe el cuerpo en un solo flujo. El editor admite encabezados, negritas, cursivas, enlaces, citas, imagenes y videos embebidos.
                </span>
              </div>

              <div class="doc-editor__toolbar-meta">
                <span class="count-pill">{{ formatArticleStatus(articleForm.status) }}</span>
                <span class="count-pill">{{ articleBodyPreviewBlocks.length }} bloques</span>
                <span class="count-pill">{{ articleWordCount() }} palabras</span>
                <span class="count-pill">{{ articleReadingTimeEstimate() }} min</span>
              </div>
            </div>

            <form class="doc-editor__form" novalidate>
              <div class="doc-editor__canvas">
                <section class="doc-editor__panel" *ngIf="activeArticleWorkspaceTab === 'format'">
                  <div class="panel-heading panel-heading--compact">
                    <div>
                      <p class="eyebrow">Jerarquia editorial</p>
                      <h3>Titular y bajada</h3>
                      <p class="panel-subtitle">Define el encabezado principal de la nota antes de entrar al contenido.</p>
                    </div>
                  </div>

                  <input
                    class="doc-editor__title-input"
                    type="text"
                    [(ngModel)]="articleForm.title"
                    name="title"
                    placeholder="Titulo del articulo"
                    required
                  />

                  <textarea
                    class="doc-editor__subtitle-input"
                    [(ngModel)]="articleForm.subtitle"
                    name="subtitle"
                    rows="3"
                    placeholder="Bajada o subtitulo"
                  ></textarea>
                </section>

                <section class="doc-editor__panel" *ngIf="activeArticleWorkspaceTab === 'media'">
                  <section class="doc-cover">
                    <div class="doc-cover__header">
                      <div>
                        <p class="eyebrow">Portada principal</p>
                        <strong>{{ articleForm.coverUrl ? "Portada cargada" : "Carga la imagen principal del articulo" }}</strong>
                      </div>
                      <span class="count-pill" *ngIf="articleForm.coverUrl">{{ articleCoverToneLabel() }}</span>
                    </div>

                    <div class="doc-cover__fields">
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
                        <span>URL o ruta de portada</span>
                        <input type="url" [(ngModel)]="articleForm.coverUrl" name="coverUrl" placeholder="/uploads/news/2026/07/portada.webp" />
                      </label>

                      <label *ngIf="isVisualCoverType(articleForm.coverType)">
                        <span>Subir portada desde el computador</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                          (change)="onCoverImageSelected($event)"
                          [disabled]="uploadingCover"
                        />
                      </label>

                      <label>
                        <span>Texto alternativo</span>
                        <input type="text" [(ngModel)]="articleForm.coverAlt" name="coverAlt" placeholder="Describe la imagen de portada" />
                      </label>
                    </div>

                    <div class="form-grid" *ngIf="articleForm.coverUrl && isVisualCoverType(articleForm.coverType)">
                      <label>
                        <span>Enfoque X: {{ articleForm.coverPositionX }}%</span>
                        <input type="range" min="0" max="100" step="0.1" [(ngModel)]="articleForm.coverPositionX" name="coverPositionX" />
                      </label>

                      <label>
                        <span>Enfoque Y: {{ articleForm.coverPositionY }}%</span>
                        <input type="range" min="0" max="100" step="0.1" [(ngModel)]="articleForm.coverPositionY" name="coverPositionY" />
                      </label>
                    </div>

                    <figure class="doc-cover__preview" *ngIf="articleDisplayCoverUrl() as coverPreview">
                      <img
                        [src]="coverPreview"
                        [alt]="articleForm.coverAlt || articleDisplayTitle()"
                        [style.object-position]="coverObjectPosition(articleForm.coverPositionX, articleForm.coverPositionY)"
                      />
                    </figure>
                  </section>
                </section>

                <section class="doc-editor__panel" *ngIf="activeArticleWorkspaceTab === 'redaction'">
                  <section class="doc-body-editor">
                    <div class="panel-heading panel-heading--compact">
                      <div>
                        <p class="eyebrow">Cuerpo de la noticia</p>
                        <h3>Editor principal</h3>
                        <p class="panel-subtitle">Redacta como en un procesador de texto y agrega multimedia desde la misma posicion del cursor.</p>
                      </div>
                    </div>

                    <div class="doc-body-editor__surface">
                      <ckeditor
                        [editor]="Editor"
                        [config]="ckeditorConfig"
                        [(ngModel)]="articleBodyHtml"
                        (ngModelChange)="onArticleBodyChange($event)"
                        name="articleBodyHtml"
                      ></ckeditor>
                    </div>

                    <div class="doc-body-editor__notes">
                      <p class="helper-text">
                        Usa “Encabezado 2” para intertitulos, “Encabezado 3” para subtitulos internos, “Cita” para destacar frases y “Insertar imagen” o
                        “Insertar contenido multimedia” desde la barra del editor.
                      </p>
                      <button class="button button--ghost" type="button" (click)="applySuggestedPreview()">Generar resumen sugerido</button>
                    </div>
                  </section>
                </section>

                <section class="doc-editor__panel" *ngIf="activeArticleWorkspaceTab === 'preview'">
                  <div class="panel-heading panel-heading--compact">
                    <div>
                      <p class="eyebrow">Vista previa</p>
                      <h3>Lectura editorial</h3>
                      <p class="panel-subtitle">Aqui validas la portada, el titular y el ritmo de la lectura antes de publicar.</p>
                    </div>
                  </div>

                  <figure class="doc-cover__preview" *ngIf="articleDisplayCoverUrl() as coverPreview">
                    <img
                      [src]="coverPreview"
                      [alt]="articleForm.coverAlt || articleDisplayTitle()"
                      [style.object-position]="coverObjectPosition(articleForm.coverPositionX, articleForm.coverPositionY)"
                    />
                  </figure>

                  <div class="doc-editor__preview-head">
                    <h2>{{ articleDisplayTitle() }}</h2>
                    <p *ngIf="articleForm.subtitle.trim()">{{ articleForm.subtitle }}</p>
                  </div>

                  <section class="doc-body-preview" *ngIf="articleBodyPreviewBlocks.length > 0; else emptyEditorialPreview">
                    <div class="panel-heading panel-heading--compact">
                      <div>
                        <p class="eyebrow">Cuerpo renderizado</p>
                        <h3>Asi se vera la lectura</h3>
                        <p class="panel-subtitle">Previsualizacion editorial antes de guardar o enviar a revision.</p>
                      </div>
                    </div>

                    <article class="article-body article-body--editor-preview">
                      <ng-container *ngFor="let block of articleBodyPreviewBlocks">
                        <ng-container *ngIf="block.type === 'heading'">
                          <h2
                            *ngIf="block.heading.level === 'h2'; else compactPreviewHeading"
                            class="article-section-heading"
                            [class.article-section-heading--center]="block.heading.align === 'center'"
                            [class.article-section-heading--right]="block.heading.align === 'right'"
                            [innerHTML]="renderPreviewBlockText(block)"
                          ></h2>
                          <ng-template #compactPreviewHeading>
                            <h3
                              class="article-section-heading article-section-heading--compact"
                              [class.article-section-heading--center]="block.heading.align === 'center'"
                              [class.article-section-heading--right]="block.heading.align === 'right'"
                              [innerHTML]="renderPreviewBlockText(block)"
                            ></h3>
                          </ng-template>
                        </ng-container>

                        <p *ngIf="block.type === 'paragraph'" [innerHTML]="renderPreviewBlockText(block)"></p>

                        <blockquote class="article-quote" *ngIf="block.type === 'quote'">
                          <p [innerHTML]="renderPreviewBlockText(block)"></p>
                          <footer class="article-quote__attribution" *ngIf="block.quote.attribution">{{ block.quote.attribution }}</footer>
                        </blockquote>

                        <figure class="article-inline-media" *ngIf="block.type === 'image' && block.image.url">
                          <img [src]="block.image.url" [alt]="block.image.alt || articleDisplayTitle()" />
                          <figcaption *ngIf="block.image.caption || block.image.alt">{{ block.image.caption || block.image.alt }}</figcaption>
                        </figure>

                        <ng-container *ngIf="block.type === 'embed'">
                          <figure class="article-inline-embed article-inline-embed--social-preview" *ngIf="socialEmbedPreviewData(block.embed.url) as socialEmbed; else previewVideoEmbedBlock">
                            <div class="article-social-preview">
                              <p class="eyebrow">{{ socialEmbed.label }}</p>
                              <strong>{{ block.embed.title || socialEmbed.title }}</strong>
                              <p>{{ socialEmbed.description }}</p>
                              <a [href]="socialEmbed.url" target="_blank" rel="noopener noreferrer">{{ socialEmbed.url }}</a>
                            </div>
                          </figure>
                          <ng-template #previewVideoEmbedBlock>
                            <figure class="article-inline-embed" *ngIf="safePreviewEmbedUrl(block.embed.url) as embedUrl">
                              <iframe
                                [src]="embedUrl"
                                [title]="block.embed.title || articleDisplayTitle()"
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowfullscreen
                              ></iframe>
                              <figcaption *ngIf="block.embed.title">{{ block.embed.title }}</figcaption>
                            </figure>
                          </ng-template>
                        </ng-container>
                      </ng-container>
                    </article>
                  </section>
                  <ng-template #emptyEditorialPreview>
                    <div class="editor-preview-placeholder">
                      <strong>La vista previa aparecera cuando empieces a redactar.</strong>
                      <p>Agrega texto, imagenes o embeds editoriales en Redaccion para revisar aqui el resultado final.</p>
                    </div>
                  </ng-template>
                </section>

                <section class="doc-editor__settings" *ngIf="activeArticleWorkspaceTab === 'publish'">
                  <div class="panel-heading panel-heading--compact">
                    <div>
                      <h3>Publicacion</h3>
                      <p class="panel-subtitle">Resumen, etiquetas, categoria y salida editorial.</p>
                    </div>
                  </div>

                  <div class="doc-editor__settings-grid">
                    <label>
                      <span>Previsualizacion corta</span>
                      <textarea [(ngModel)]="articleForm.excerpt" name="excerpt" rows="4" placeholder="Resumen corto para portada, SEO y compartidos"></textarea>
                    </label>

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

                    <label *ngIf="currentUser.role === 'admin'">
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

                    <label class="editor-checkbox" *ngIf="currentUser.role === 'admin'">
                      <input type="checkbox" [(ngModel)]="articleForm.featured" name="featured" />
                      <span>Destacar en portada</span>
                    </label>
                  </div>

                  <div class="button-row">
                    <button class="button button--ghost" type="button" (click)="applySuggestedPreview()">Generar resumen sugerido</button>
                    <span class="count-pill">{{ articleForm.contentBlocks.length }} bloques</span>
                  </div>

                  <div class="editor-note editor-note--warm" *ngIf="currentUser.role !== 'admin' && reviewConfirmationOpen">
                    <strong>Confirmacion editorial</strong>
                    <p>La nota se guardara y se enviara a revision final.</p>
                  </div>

                  <div class="doc-editor__actions" *ngIf="currentUser.role === 'admin'; else journalistDocActions">
                    <button class="button" type="button" (click)="saveArticle()" [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()">
                      {{ savingArticle ? "Guardando..." : selectedArticleId ? "Guardar cambios" : "Crear articulo" }}
                    </button>
                  </div>

                  <ng-template #journalistDocActions>
                    <div class="doc-editor__actions" *ngIf="!reviewConfirmationOpen; else journalistDocConfirm">
                      <button class="button button--secondary" type="button" (click)="saveArticle()" [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()">
                        {{ savingArticle ? "Guardando..." : selectedArticleId ? "Guardar borrador" : "Crear borrador" }}
                      </button>
                      <button class="button" type="button" (click)="openReviewConfirmation()" [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()">
                        Enviar a revision
                      </button>
                    </div>

                    <ng-template #journalistDocConfirm>
                      <div class="doc-editor__actions">
                        <button class="button button--ghost" type="button" (click)="requestLastArticleReview()">Seguir editando</button>
                        <button class="button" type="button" (click)="saveArticle({ submitForReview: true })" [disabled]="savingArticle || uploadingCover || hasUploadingContentBlocks()">
                          {{ savingArticle ? "Enviando..." : "Confirmar envio" }}
                        </button>
                      </div>
                    </ng-template>
                  </ng-template>
                </section>
              </div>
            </form>
          </div>

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
    .dashboard-grid--editor {
      grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
      align-items: start;
    }

    .editor-studio {
      display: grid;
      grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.92fr);
      gap: 20px;
      align-items: start;
      margin-top: 20px;
    }

    .editor-studio__rail,
    .editor-studio__workspace,
    .editor-studio__inspector {
      display: grid;
      gap: 18px;
      align-content: start;
    }

    .editor-studio-card {
      display: grid;
      gap: 16px;
      padding: 18px;
      border-radius: 26px;
      border: 1px solid var(--border-strong);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent),
        var(--surface);
      box-shadow: var(--shadow-soft);
    }

    .editor-studio-card--workspace {
      padding: 20px;
    }

    .editor-studio-card--hero {
      background:
        linear-gradient(135deg, rgba(255, 208, 77, 0.08), rgba(44, 85, 177, 0.08)),
        var(--surface);
    }

    .editor-studio-card--sticky {
      position: sticky;
      top: 18px;
    }

    .editor-studio-hero {
      display: grid;
      gap: 18px;
    }

    .editor-studio-hero__copy {
      display: grid;
      gap: 10px;
    }

    .panel-heading--compact {
      gap: 12px;
      margin-bottom: 0;
    }

    .editor-studio__title {
      font-family: var(--headline);
      font-size: clamp(1.35rem, 2vw, 1.75rem);
      line-height: 1.1;
      color: var(--text);
    }

    .editor-studio__metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .editor-studio__metric {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(9, 14, 27, 0.32);
    }

    .editor-studio__metric span {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .editor-studio__metric strong {
      color: var(--text);
      font-size: 0.98rem;
    }

    .editor-stepper--stack {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .editor-outline-list {
      display: grid;
      gap: 8px;
      max-height: 420px;
      overflow: auto;
      padding-right: 6px;
    }

    .editor-outline-item {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      width: 100%;
      padding: 12px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(9, 14, 27, 0.18);
      color: var(--text);
      text-align: left;
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
    }

    .editor-outline-item:hover,
    .editor-outline-item:focus-visible {
      transform: translateY(-1px);
      border-color: rgba(90, 125, 255, 0.35);
      background: rgba(13, 22, 42, 0.34);
    }

    .editor-outline-item.is-active {
      border-color: rgba(255, 208, 77, 0.34);
      background: linear-gradient(135deg, rgba(255, 208, 77, 0.16), rgba(66, 102, 232, 0.16));
      box-shadow: 0 0 0 1px rgba(255, 208, 77, 0.08);
    }

    .editor-outline-item__index {
      display: inline-grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.05);
      font-weight: 700;
      color: var(--text);
    }

    .editor-outline-item__body {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .editor-outline-item__body strong {
      color: var(--text);
      font-size: 0.95rem;
    }

    .editor-outline-item__body small {
      color: var(--muted);
      line-height: 1.45;
      white-space: normal;
      word-break: break-word;
    }

    .editor-studio-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .editor-studio-toolbar strong {
      color: var(--text);
      font-size: 1.05rem;
    }

    .editor-studio-toolbar__meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .editor-form--studio {
      display: grid;
      gap: 18px;
    }

    .wordpress-editor {
      display: grid;
      gap: 18px;
    }

    .wordpress-editor__head {
      display: grid;
      gap: 16px;
      padding: 20px;
      border-radius: 24px;
      border: 1px solid var(--border);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent),
        rgba(10, 16, 28, 0.42);
    }

    .wordpress-editor__title-field,
    .wordpress-editor__subtitle-field,
    .content-block label,
    .editor-sidebar-panel label {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .wordpress-editor__title-field span,
    .content-block label span,
    .editor-sidebar-panel label span {
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .wordpress-editor__title-input {
      min-height: 84px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: var(--text);
      font-family: var(--headline);
      font-size: clamp(2.1rem, 4vw, 3.6rem);
      line-height: 1.02;
    }

    .wordpress-editor__title-input::placeholder {
      color: rgba(176, 188, 214, 0.62);
    }

    .wordpress-editor__subtitle-field textarea {
      min-height: 110px;
      resize: vertical;
      font-size: 1rem;
      line-height: 1.7;
    }

    .content-builder-toolbar {
      position: sticky;
      top: 14px;
      z-index: 4;
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: center;
      padding: 16px 18px;
      border-radius: 22px;
      border: 1px solid var(--border);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent),
        rgba(12, 18, 31, 0.94);
      backdrop-filter: blur(16px);
      box-shadow: var(--shadow-soft);
    }

    .content-builder-toolbar__label {
      display: grid;
      gap: 4px;
    }

    .content-builder-toolbar__label strong {
      color: var(--text);
      font-size: 1rem;
    }

    .content-builder-toolbar__label span {
      color: var(--muted);
      line-height: 1.55;
    }

    .content-builder {
      display: grid;
      gap: 18px;
    }

    .content-block {
      display: grid;
      gap: 16px;
      padding: 20px;
      border-radius: 24px;
      border: 1px solid var(--border);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent),
        rgba(10, 16, 28, 0.58);
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .content-block:hover {
      border-color: rgba(132, 169, 255, 0.2);
      transform: translateY(-1px);
    }

    .content-block__header,
    .content-block__quick-add {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .content-block__quick-add {
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }

    .content-block textarea {
      resize: vertical;
    }

    .content-block textarea[name^="blockText"] {
      min-height: 230px;
      font-size: 1.04rem;
      line-height: 1.85;
    }

    .content-block textarea[name^="blockHeadingText"] {
      min-height: 120px;
      font-family: var(--headline);
      font-size: clamp(1.7rem, 2.4vw, 2.4rem);
      line-height: 1.12;
      font-weight: 700;
    }

    .content-block textarea[name^="blockQuoteText"] {
      min-height: 160px;
      font-family: var(--headline);
      font-size: 1.2rem;
      line-height: 1.7;
    }

    .editor-image-preview,
    .editor-embed-preview {
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
    }

    .editor-image-preview {
      margin: 0;
    }

    .editor-image-preview img {
      width: 100%;
      max-height: 420px;
      object-fit: cover;
    }

    .editor-image-preview figcaption {
      padding: 12px 14px;
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.55;
    }

    .editor-embed-preview iframe {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
    }

    .doc-editor {
      display: grid;
      gap: 18px;
      margin-top: 20px;
    }

    .doc-editor__menu {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      padding: 0;
    }

    .doc-editor__menu-tab {
      display: grid;
      gap: 4px;
      padding: 14px 16px;
      text-align: left;
      border-radius: 18px;
      border: 1px solid var(--border);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent),
        rgba(10, 16, 28, 0.36);
      color: var(--muted);
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
    }

    .doc-editor__menu-tab span {
      color: var(--text);
      font-size: 0.94rem;
      font-weight: 700;
    }

    .doc-editor__menu-tab small {
      color: var(--muted);
      line-height: 1.45;
      font-size: 0.78rem;
    }

    .doc-editor__menu-tab:hover,
    .doc-editor__menu-tab:focus-visible {
      transform: translateY(-1px);
      border-color: rgba(132, 169, 255, 0.26);
      box-shadow: var(--shadow-soft);
    }

    .doc-editor__menu-tab.is-active {
      border-color: rgba(255, 208, 77, 0.34);
      background:
        linear-gradient(135deg, rgba(255, 208, 77, 0.14), rgba(66, 102, 232, 0.14)),
        rgba(10, 16, 28, 0.46);
      box-shadow: var(--shadow-soft);
    }

    .doc-editor__toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-radius: 22px;
      border: 1px solid var(--border-strong);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent),
        var(--surface);
      box-shadow: var(--shadow-soft);
    }

    .doc-editor__toolbar-group,
    .doc-editor__toolbar-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .doc-editor__form,
    .doc-editor__canvas {
      display: grid;
      gap: 18px;
    }

    .doc-editor__page,
    .doc-editor__settings,
    .doc-editor__panel {
      width: min(100%, 920px);
      margin: 0 auto;
      padding: 28px 32px;
      border-radius: 28px;
      border: 1px solid rgba(18, 28, 46, 0.12);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 20px 50px rgba(9, 18, 33, 0.12);
    }

    .doc-editor__page,
    .doc-editor__panel {
      display: grid;
      gap: 24px;
    }

    .doc-editor__panel {
      min-height: 620px;
    }

    :host-context(:root[data-theme="dark"]) .doc-editor__page,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings,
    :host-context(:root[data-theme="dark"]) .doc-editor__panel {
      border-color: rgba(176, 188, 214, 0.12);
      background: rgba(12, 16, 23, 0.96);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
    }

    .doc-editor__preview-head {
      display: grid;
      gap: 10px;
    }

    .doc-editor__preview-head h2 {
      margin: 0;
      font-family: var(--headline);
      font-size: clamp(2rem, 3vw, 3rem);
      line-height: 1.04;
      color: var(--text);
    }

    .doc-editor__preview-head p {
      margin: 0;
      color: var(--muted);
      font-size: 1.02rem;
      line-height: 1.75;
    }

    .doc-editor__title-input,
    .doc-editor__subtitle-input,
    .doc-block__heading-input,
    .doc-block__paragraph-input,
    .doc-block__quote-input {
      width: 100%;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: #16233a;
    }

    .doc-editor__title-input {
      min-height: 90px;
      font-family: var(--headline);
      font-size: clamp(2.4rem, 4vw, 3.8rem);
      line-height: 1.02;
      font-weight: 700;
    }

    .doc-editor__subtitle-input {
      min-height: 80px;
      resize: none;
      font-size: 1.12rem;
      line-height: 1.8;
      color: #52637d;
    }

    .doc-editor__title-input::placeholder,
    .doc-editor__subtitle-input::placeholder,
    .doc-block__heading-input::placeholder,
    .doc-block__paragraph-input::placeholder,
    .doc-block__quote-input::placeholder {
      color: rgba(82, 99, 125, 0.58);
    }

    .doc-cover {
      display: grid;
      gap: 16px;
      padding: 20px;
      border-radius: 22px;
      border: 1px solid rgba(18, 28, 46, 0.1);
      background: rgba(245, 247, 251, 0.9);
    }

    .doc-cover__header {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      flex-wrap: wrap;
    }

    .doc-cover__header strong {
      color: #16233a;
      font-size: 1rem;
    }

    .doc-cover__fields,
    .doc-block__asset-fields,
    .doc-block__options,
    .doc-editor__settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .doc-cover label,
    .doc-block label,
    .doc-editor__settings label {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .doc-cover label span,
    .doc-block label span,
    .doc-editor__settings label span {
      color: #52637d;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .doc-cover__preview,
    .doc-block__image-preview,
    .doc-block__embed-preview {
      margin: 0;
      overflow: hidden;
      border-radius: 20px;
      border: 1px solid rgba(18, 28, 46, 0.1);
      background: #f4f7fb;
    }

    .doc-cover__preview img,
    .doc-block__image-preview img {
      width: 100%;
      display: block;
      max-height: 460px;
      object-fit: cover;
    }

    .doc-body-editor,
    .doc-body-preview {
      display: grid;
      gap: 16px;
      padding: 20px;
      border-radius: 22px;
      border: 1px solid rgba(18, 28, 46, 0.1);
      background: rgba(245, 247, 251, 0.88);
    }

    .doc-body-editor__surface {
      border: 1px solid rgba(18, 28, 46, 0.1);
      border-radius: 20px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
    }

    .doc-body-editor__notes {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    .doc-body-preview .article-body {
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    .doc-body-preview .article-body p:first-child,
    .doc-body-preview .article-body h2:first-child,
    .doc-body-preview .article-body h3:first-child,
    .doc-body-preview .article-body blockquote:first-child,
    .doc-body-preview .article-body figure:first-child {
      margin-top: 0;
    }

    :host ::ng-deep .ck.ck-editor {
      display: block;
    }

    :host ::ng-deep .ck.ck-toolbar {
      border: 0;
      border-bottom: 1px solid rgba(18, 28, 46, 0.08);
      background: linear-gradient(180deg, rgba(245, 248, 252, 0.98), rgba(233, 239, 248, 0.94));
      padding: 10px 12px;
      gap: 4px;
    }

    :host ::ng-deep .ck.ck-button,
    :host ::ng-deep .ck.ck-dropdown__button {
      border-radius: 12px;
    }

    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable {
      min-height: 420px;
      padding: 28px 30px;
      border: 0;
      color: #142038;
      background: rgba(255, 255, 255, 0.99);
      box-shadow: none;
      font-family: var(--body);
      font-size: 1.05rem;
      line-height: 1.9;
    }

    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable h2,
    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable h3 {
      font-family: var(--headline);
      color: #13203a;
      line-height: 1.12;
    }

    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable h2 {
      font-size: clamp(1.9rem, 2.8vw, 2.5rem);
      margin: 1.4rem 0 0.75rem;
    }

    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable h3 {
      font-size: clamp(1.35rem, 2.2vw, 1.8rem);
      margin: 1.1rem 0 0.65rem;
    }

    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable blockquote {
      border-left: 4px solid rgba(21, 72, 167, 0.3);
      margin: 1.5rem 0;
      padding: 0.25rem 0 0.25rem 1rem;
      color: #3d4d66;
      font-family: var(--headline);
      font-size: 1.18rem;
    }

    :host ::ng-deep .ck.ck-editor__main > .ck-editor__editable a {
      color: #1548a7;
      text-decoration-color: rgba(21, 72, 167, 0.38);
      text-underline-offset: 0.16em;
    }

    :host-context(:root[data-theme="dark"]) .doc-body-editor,
    :host-context(:root[data-theme="dark"]) .doc-body-preview {
      border-color: rgba(176, 188, 214, 0.12);
      background: rgba(16, 20, 28, 0.92);
    }

    :host-context(:root[data-theme="dark"]) .doc-body-editor__surface {
      border-color: rgba(176, 188, 214, 0.14);
      background: rgba(9, 12, 18, 0.98);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    :host-context(:root[data-theme="dark"]) :host ::ng-deep .ck.ck-toolbar,
    :host-context(:root[data-theme="dark"]) ::ng-deep .ck.ck-toolbar {
      border-bottom-color: rgba(176, 188, 214, 0.1);
      background: linear-gradient(180deg, rgba(18, 23, 33, 0.98), rgba(11, 15, 23, 0.96));
    }

    :host-context(:root[data-theme="dark"]) ::ng-deep .ck.ck-editor__main > .ck-editor__editable {
      color: #eef4ff;
      background: rgba(9, 12, 18, 0.99);
    }

    :host-context(:root[data-theme="dark"]) ::ng-deep .ck.ck-editor__main > .ck-editor__editable h2,
    :host-context(:root[data-theme="dark"]) ::ng-deep .ck.ck-editor__main > .ck-editor__editable h3 {
      color: #f8fbff;
    }

    :host-context(:root[data-theme="dark"]) ::ng-deep .ck.ck-editor__main > .ck-editor__editable blockquote {
      border-left-color: rgba(255, 208, 77, 0.34);
      color: #d4dcec;
    }

    :host-context(:root[data-theme="dark"]) ::ng-deep .ck.ck-editor__main > .ck-editor__editable a {
      color: #9abbff;
      text-decoration-color: rgba(154, 187, 255, 0.42);
    }

    .doc-block__image-preview figcaption {
      padding: 12px 14px;
      color: #52637d;
      line-height: 1.55;
    }

    .doc-block__embed-preview iframe {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
    }

    .doc-blocks {
      display: grid;
      gap: 18px;
    }

    .doc-block {
      display: grid;
      gap: 14px;
      padding: 12px 0;
      border-top: 1px solid rgba(18, 28, 46, 0.08);
    }

    .doc-block:first-child {
      border-top: 0;
    }

    .doc-block.is-selected {
      padding-inline: 12px;
      margin-inline: -12px;
      border-radius: 18px;
      background: rgba(67, 97, 185, 0.07);
      border-top-color: transparent;
      box-shadow: inset 0 0 0 1px rgba(67, 97, 185, 0.12);
    }

    .doc-block__meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .doc-block__insert {
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--flag-blue);
      font-size: 0.92rem;
      font-weight: 700;
    }

    .doc-block__insertbar {
      display: grid;
      gap: 10px;
      padding-top: 14px;
      border-top: 1px dashed rgba(18, 28, 46, 0.12);
    }

    .doc-block__insertbar-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .doc-block--heading .doc-block__heading-input {
      min-height: 90px;
      font-family: var(--headline);
      font-size: clamp(1.8rem, 3vw, 2.6rem);
      line-height: 1.15;
      font-weight: 700;
    }

    .doc-block--paragraph .doc-block__paragraph-input {
      min-height: 220px;
      resize: vertical;
      font-size: 1.08rem;
      line-height: 1.92;
    }

    .doc-block--quote .doc-block__quote-input {
      min-height: 140px;
      resize: vertical;
      font-family: var(--headline);
      font-size: 1.28rem;
      line-height: 1.7;
    }

    .doc-editor__add-row,
    .doc-editor__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .doc-editor__settings {
      display: grid;
      gap: 18px;
    }

    .doc-editor__settings .panel-heading h3,
    .doc-editor__settings .panel-subtitle,
    .doc-editor__settings .helper-text,
    .doc-cover .helper-text {
      color: #52637d;
    }

    .doc-editor__settings textarea,
    .doc-editor__settings input,
    .doc-editor__settings select,
    .doc-cover input,
    .doc-cover select,
    .doc-block input,
    .doc-block select {
      color: #16233a;
      background: rgba(255, 255, 255, 0.96);
      border-color: rgba(18, 28, 46, 0.12);
    }

    .doc-editor__settings .count-pill,
    .doc-cover .count-pill,
    .doc-block .count-pill {
      color: #28467a;
      border-color: rgba(40, 70, 122, 0.14);
      background: rgba(40, 70, 122, 0.08);
    }

    .doc-editor__settings .editor-note {
      border-color: rgba(255, 208, 77, 0.26);
      background: linear-gradient(135deg, rgba(255, 208, 77, 0.16), rgba(201, 53, 53, 0.08));
    }

    :host-context(:root[data-theme="dark"]) .doc-editor__settings .panel-heading h3 {
      color: #f4f7ff;
    }

    :host-context(:root[data-theme="dark"]) .doc-cover label span,
    :host-context(:root[data-theme="dark"]) .doc-block label span,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings label span,
    :host-context(:root[data-theme="dark"]) .editor-checkbox span,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings .panel-subtitle,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings .helper-text,
    :host-context(:root[data-theme="dark"]) .doc-cover .helper-text {
      color: #9db2d8;
    }

    :host-context(:root[data-theme="dark"]) .doc-editor__settings textarea,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings input,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings select,
    :host-context(:root[data-theme="dark"]) .doc-cover input,
    :host-context(:root[data-theme="dark"]) .doc-cover select,
    :host-context(:root[data-theme="dark"]) .doc-block input,
    :host-context(:root[data-theme="dark"]) .doc-block select {
      color: #eef4ff;
      background: rgba(18, 24, 35, 0.96);
      border-color: rgba(154, 187, 255, 0.18);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    :host-context(:root[data-theme="dark"]) .doc-editor__settings textarea::placeholder,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings input::placeholder,
    :host-context(:root[data-theme="dark"]) .doc-cover input::placeholder,
    :host-context(:root[data-theme="dark"]) .doc-block input::placeholder {
      color: rgba(196, 210, 235, 0.7);
    }

    :host-context(:root[data-theme="dark"]) .doc-editor__settings textarea:focus,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings input:focus,
    :host-context(:root[data-theme="dark"]) .doc-editor__settings select:focus,
    :host-context(:root[data-theme="dark"]) .doc-cover input:focus,
    :host-context(:root[data-theme="dark"]) .doc-cover select:focus,
    :host-context(:root[data-theme="dark"]) .doc-block input:focus,
    :host-context(:root[data-theme="dark"]) .doc-block select:focus {
      border-color: rgba(255, 208, 77, 0.42);
      box-shadow:
        0 0 0 3px rgba(255, 208, 77, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .content-block.is-selected {
      border-color: rgba(90, 125, 255, 0.34);
      box-shadow:
        0 0 0 1px rgba(90, 125, 255, 0.14),
        var(--shadow-soft);
      background:
        linear-gradient(180deg, rgba(104, 132, 255, 0.08), transparent),
        rgba(13, 20, 36, 0.9);
    }

    .editor-preview-modes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .editor-preview-mode {
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(9, 14, 27, 0.18);
      color: var(--muted);
      font-weight: 600;
      transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
    }

    .editor-preview-mode:hover,
    .editor-preview-mode:focus-visible {
      transform: translateY(-1px);
      color: var(--text);
      border-color: rgba(90, 125, 255, 0.3);
    }

    .editor-preview-mode.is-active {
      color: var(--text);
      border-color: rgba(255, 208, 77, 0.34);
      background: linear-gradient(135deg, rgba(255, 208, 77, 0.16), rgba(66, 102, 232, 0.16));
    }

    .editor-preview-sheet,
    .editor-preview-home,
    .editor-preview-mobile,
    .editor-preview-share {
      display: grid;
      gap: 14px;
    }

    .editor-preview-hero__media,
    .editor-preview-home__media,
    .editor-preview-share__media {
      margin: 0;
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
    }

    .editor-preview-hero__media {
      aspect-ratio: 16 / 10;
    }

    .editor-preview-home__media,
    .editor-preview-share__media {
      aspect-ratio: 16 / 9;
    }

    .editor-preview-hero__media img,
    .editor-preview-home__media img,
    .editor-preview-share__media img,
    .editor-preview-block--image img,
    .editor-mobile-frame__media img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .editor-preview-hero {
      display: grid;
      gap: 10px;
    }

    .editor-preview-hero h3,
    .editor-preview-home__body h3,
    .editor-mobile-frame__body h3,
    .editor-preview-share__body strong {
      margin: 0;
      font-family: var(--headline);
      color: var(--text);
      line-height: 1.06;
    }

    .editor-preview-hero h3 {
      font-size: clamp(1.7rem, 2.3vw, 2.4rem);
    }

    .editor-preview-hero p,
    .editor-preview-home__body p,
    .editor-mobile-frame__body p,
    .editor-preview-share__body p {
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
    }

    .editor-preview-content {
      display: grid;
      gap: 14px;
      max-height: 520px;
      overflow: auto;
      padding-right: 6px;
    }

    .editor-preview-block {
      display: grid;
      gap: 8px;
    }

    .editor-preview-block h4,
    .editor-preview-block p,
    .editor-preview-block blockquote,
    .editor-preview-block strong {
      margin: 0;
      color: var(--text);
    }

    .editor-preview-block p {
      line-height: 1.8;
    }

    .editor-preview-block--quote {
      padding: 16px 18px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
    }

    .editor-preview-block--quote blockquote {
      font-family: var(--headline);
      font-size: 1.08rem;
      line-height: 1.6;
    }

    .editor-preview-block--quote span {
      color: var(--muted);
      font-size: 0.92rem;
    }

    .editor-preview-block--image {
      margin: 0;
      overflow: hidden;
      border-radius: 20px;
      border: 1px solid var(--border);
    }

    .editor-preview-block--image figcaption {
      padding: 12px 14px;
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.5;
      background: rgba(255, 255, 255, 0.03);
    }

    .editor-preview-home__card,
    .editor-preview-share__card {
      display: grid;
      gap: 0;
      overflow: hidden;
      border-radius: 26px;
      border: 1px solid var(--border-strong);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent),
        var(--surface-strong);
      box-shadow: var(--shadow-soft);
    }

    .editor-preview-home__body,
    .editor-preview-share__body {
      display: grid;
      gap: 10px;
      padding: 18px;
    }

    .editor-preview-share__body span {
      color: var(--flag-blue);
      font-size: 0.88rem;
      word-break: break-word;
    }

    .editor-mobile-frame {
      width: min(100%, 330px);
      margin: 0 auto;
      padding: 14px;
      border-radius: 30px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(180deg, rgba(9, 16, 28, 0.98), rgba(6, 10, 18, 0.98));
      box-shadow: var(--shadow);
    }

    .editor-mobile-frame__screen {
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(9, 14, 27, 0.9);
    }

    .editor-mobile-frame__media {
      margin: 0;
      aspect-ratio: 4 / 3;
    }

    .editor-mobile-frame__body {
      display: grid;
      gap: 10px;
      padding: 16px;
    }

    .editor-mobile-frame__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .editor-preview-placeholder {
      display: grid;
      gap: 8px;
      place-items: center;
      min-height: 180px;
      padding: 20px;
      text-align: center;
      border-radius: 22px;
      border: 1px dashed var(--border);
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
    }

    .editor-preview-placeholder--compact {
      min-height: 120px;
    }

    .editor-inspector-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .editor-inspector-list {
      display: grid;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }

    .editor-inspector-list__item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      color: var(--muted);
      font-size: 0.94rem;
    }

    .editor-inspector-list__item strong {
      color: var(--text);
      text-align: right;
    }

    .editor-sidebar-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .editor-sidebar-tab {
      padding: 11px 14px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: rgba(9, 14, 27, 0.2);
      color: var(--muted);
      font-weight: 700;
      transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
    }

    .editor-sidebar-tab:hover,
    .editor-sidebar-tab:focus-visible {
      transform: translateY(-1px);
      color: var(--text);
      border-color: rgba(132, 169, 255, 0.22);
    }

    .editor-sidebar-tab.is-active {
      color: var(--text);
      border-color: rgba(255, 208, 77, 0.36);
      background: linear-gradient(135deg, rgba(255, 208, 77, 0.14), rgba(44, 85, 177, 0.14));
    }

    .editor-sidebar-panel {
      display: grid;
      gap: 16px;
    }

    .editor-sidebar-actions {
      display: grid;
      gap: 10px;
    }

    .editor-note {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
    }

    .editor-note strong {
      color: var(--text);
    }

    .editor-note p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }

    .editor-note--warm {
      border-color: rgba(255, 208, 77, 0.22);
      background: linear-gradient(135deg, rgba(255, 208, 77, 0.1), rgba(201, 53, 53, 0.08));
    }

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

    @media (max-width: 1380px) {
      .editor-studio {
        grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.92fr);
      }

      .editor-studio-card--sticky {
        position: static;
      }
    }

    @media (max-width: 1080px) {
      .editor-studio {
        grid-template-columns: 1fr;
      }

      .dashboard-grid--editor {
        grid-template-columns: 1fr;
      }

      .doc-editor__menu {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .doc-editor__toolbar {
        align-items: flex-start;
      }

      .doc-cover__fields,
      .doc-block__asset-fields,
      .doc-block__options,
      .doc-editor__settings-grid {
        grid-template-columns: 1fr;
      }

      .editor-studio__metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .content-builder-toolbar {
        position: static;
        align-items: flex-start;
        flex-direction: column;
      }

      .editor-studio-toolbar {
        flex-direction: column;
      }

      .editor-studio-toolbar__meta {
        justify-content: flex-start;
      }
    }

    @media (max-width: 640px) {
      .doc-editor__menu {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .doc-editor__page,
      .doc-editor__settings,
      .doc-editor__panel {
        padding: 18px;
        border-radius: 22px;
      }

      .doc-editor__title-input {
        min-height: 70px;
        font-size: clamp(2rem, 8vw, 2.7rem);
      }

      .doc-editor__subtitle-input {
        font-size: 1rem;
      }

      .editor-studio {
        gap: 16px;
      }

      .wordpress-editor__head,
      .content-block {
        padding: 16px;
        border-radius: 22px;
      }

      .editor-studio-card,
      .editor-studio-card--workspace {
        padding: 16px;
        border-radius: 22px;
      }

      .editor-studio__metrics {
        grid-template-columns: 1fr;
      }

      .editor-preview-modes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .editor-sidebar-tabs {
        grid-template-columns: 1fr 1fr;
      }

      .editor-preview-mode {
        width: 100%;
        justify-content: center;
      }

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
  readonly articleWorkspaceTabs: ArticleWorkspaceTabConfig[] = [
    { id: "redaction", label: "Redaccion", description: "Cuerpo principal de la noticia." },
    { id: "format", label: "Formato", description: "Titulo y bajada editorial." },
    { id: "media", label: "Multimedia", description: "Portada, carga y enfoque." },
    { id: "preview", label: "Vista previa", description: "Lectura antes de publicar." },
    { id: "publish", label: "Publicacion", description: "Resumen, etiquetas y salida." }
  ];

  activeSection: DashboardSection = "overview";
  activeOverviewPanel: OverviewPanel = "recent";
  activeArticleWorkspaceTab: ArticleWorkspaceTab = "redaction";
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
  editorPreviewMode: EditorPreviewMode = "article";
  editorSidebarTab: EditorSidebarTab = "document";
  selectedContentBlockIndex = 0;
  activeBlockCursor: BlockCursorState | null = null;
  passwordVisibility: Record<PasswordFieldKey, boolean> = {
    user: false,
    current: false,
    next: false,
    confirm: false
  };
  readonly Editor = ClassicEditor;
  readonly ckeditorConfig: Record<string, unknown> = {
    licenseKey: "GPL",
    language: "es",
    translations: [esTranslations],
    plugins: [
      Essentials,
      Paragraph,
      Heading,
      Autoformat,
      PasteFromOffice,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Link,
      BlockQuote,
      Image,
      ImageCaption,
      ImageToolbar,
      ImageInsert,
      ImageUpload,
      AutoImage,
      MediaEmbed
    ],
    toolbar: {
      items: ["undo", "redo", "|", "heading", "|", "bold", "italic", "underline", "strikethrough", "link", "blockQuote", "|", "insertImage", "mediaEmbed"],
      shouldNotGroupWhenFull: true
    },
    heading: {
      options: [
        { model: "paragraph", title: "Párrafo", class: "ck-heading_paragraph" },
        { model: "heading2", view: "h2", title: "Encabezado 2", class: "ck-heading_heading2" },
        { model: "heading3", view: "h3", title: "Encabezado 3", class: "ck-heading_heading3" }
      ]
    },
    image: {
      toolbar: ["imageTextAlternative", "toggleImageCaption"]
    },
    link: {
      addTargetToExternalLinks: true,
      defaultProtocol: "https://"
    },
    mediaEmbed: {
      previewsInData: false,
      extraProviders: [
        {
          name: "x",
          url: [
            /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com|mobile\.twitter\.com|mobile\.x\.com)\/[^/]+\/status(?:es)?\/\d+(?:\?.*)?$/i
          ],
          html: (match: RegExpMatchArray) => {
            const sourceUrl = Array.isArray(match) ? match[0] ?? "" : "";
            const safeUrl = this.escapeHtml(sourceUrl);
            return [
              "<div class=\"ck-embed-preview ck-embed-preview--tweet\">",
              "<strong>Tweet incrustado</strong>",
              "<p>Se publicara dentro del articulo como una tarjeta de X/Twitter.</p>",
              `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`,
              "</div>"
            ].join("");
          }
        },
        {
          name: "instagramSocial",
          url: [
            /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/[A-Za-z0-9_-]{5,}(?:\/)?(?:\?.*)?$/i
          ],
          html: (match: RegExpMatchArray) => {
            const sourceUrl = Array.isArray(match) ? match[0] ?? "" : "";
            const safeUrl = this.escapeHtml(sourceUrl);
            return [
              "<div class=\"ck-embed-preview ck-embed-preview--instagram\">",
              "<strong>Post de Instagram</strong>",
              "<p>Se publicara dentro del articulo como una tarjeta incrustada de Instagram.</p>",
              `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`,
              "</div>"
            ].join("");
          }
        }
      ]
    },
    extraPlugins: [
      createEditorialUploadAdapterPlugin((file) => this.handleEditorImageUpload(file))
    ],
    placeholder: "Redacta aqui la noticia. Puedes insertar intertitulos, citas, enlaces, imagenes, videos y publicaciones sociales dentro del mismo flujo."
  };
  articleBodyHtml = "<p></p>";
  articleBodyPreviewBlocks: ArticleContentBlock[] = [];
  articleBodyPlainText = "";

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

  onArticleBodyChange(value: string): void {
    this.articleBodyHtml = value;
    this.syncArticleBodyPreview(this.editorHtmlToContentBlocks(value));
    this.cdr.markForCheck();
  }

  renderPreviewBlockText(block: ArticleContentBlock): string {
    if (block.type === "heading") {
      return this.renderRichEditorialContent(block.heading.text);
    }

    if (block.type === "paragraph") {
      return this.renderRichEditorialContent(block.text);
    }

    if (block.type === "quote") {
      return this.renderRichEditorialContent(block.quote.text);
    }

    return "";
  }

  safePreviewEmbedUrl(value: string): SafeResourceUrl | null {
    const resolved = resolveVideoEmbed(value);
    return resolved?.embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(resolved.embedUrl) : null;
  }

  isTweetEmbedUrl(value: string): boolean {
    return isTweetEmbed(value);
  }

  tweetEmbedSource(value: string): string | null {
    return resolveTweetEmbedSource(value);
  }

  isInstagramEmbedUrl(value: string): boolean {
    return isInstagramEmbed(value);
  }

  instagramEmbedSource(value: string): string | null {
    return resolveInstagramEmbedSource(value);
  }

  socialEmbedPreviewData(value: string): { label: string; title: string; description: string; url: string } | null {
    const tweetUrl = this.tweetEmbedSource(value);

    if (tweetUrl) {
      return {
        label: "X / Twitter",
        title: "Tweet incrustado",
        description: "Se mostrara dentro del articulo como una tarjeta editorial de X/Twitter.",
        url: tweetUrl
      };
    }

    const instagramUrl = this.instagramEmbedSource(value);

    if (instagramUrl) {
      return {
        label: "Instagram",
        title: "Post de Instagram",
        description: "Se mostrara dentro del articulo como una tarjeta incrustada de Instagram.",
        url: instagramUrl
      };
    }

    return null;
  }

  visibleSections(currentUser: UserSession): SectionConfig[] {
    return this.sections.filter((section) => !section.adminOnly || currentUser.role === "admin");
  }

  setActiveOverviewPanel(panel: OverviewPanel): void {
    this.activeOverviewPanel = panel;
    this.cdr.markForCheck();
  }

  setActiveArticleWorkspaceTab(tab: ArticleWorkspaceTab): void {
    this.activeArticleWorkspaceTab = tab;
    this.cdr.markForCheck();
  }

  overviewPanelTitle(): string {
    if (this.activeOverviewPanel === "top") {
      return "Mas vistos";
    }

    if (this.activeOverviewPanel === "account") {
      return "Cuenta y atajos";
    }

    return "Actividad reciente";
  }

  overviewPanelSubtitle(): string {
    if (this.activeOverviewPanel === "top") {
      return "Lecturas, traccion y piezas que hoy estan ganando visibilidad.";
    }

    if (this.activeOverviewPanel === "account") {
      return "Perfil, seguridad y accesos directos sin saturar el inicio.";
    }

    return "Acceso rapido a las piezas que se estan moviendo hoy.";
  }

  overviewRecentArticles(): DashboardArticle[] {
    return (this.overview?.recentArticles ?? []).slice(0, 4);
  }

  overviewTopViewedArticles(): DashboardArticle[] {
    return (this.overview?.topViewedArticles ?? []).slice(0, 4);
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
    if (type === "heading") {
      return "Titulo";
    }

    if (type === "quote") {
      return "Cita";
    }

    if (type === "image") {
      return "Foto";
    }

    if (type === "embed") {
      return "Embed";
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

      if (type === "heading") {
        return block.headingText.trim().length > 0;
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

  setEditorPreviewMode(mode: EditorPreviewMode): void {
    this.editorPreviewMode = mode;
    this.cdr.markForCheck();
  }

  setEditorSidebarTab(tab: EditorSidebarTab): void {
    this.editorSidebarTab = tab;
    this.cdr.markForCheck();
  }

  currentArticleStepConfig(): ArticleEditorStepConfig | undefined {
    return this.articleSteps.find((step) => step.id === this.activeArticleStep);
  }

  selectContentBlock(index: number, focus = false): void {
    if (index < 0 || index >= this.articleForm.contentBlocks.length) {
      return;
    }

    this.selectedContentBlockIndex = index;

    if (this.activeArticleStep !== "body") {
      this.openArticleStep("body");
    } else {
      this.cdr.markForCheck();
    }

    if (focus) {
      this.focusContentBlock(index);
    }
  }

  selectedContentBlock(): EditorContentBlock | null {
    return this.articleForm.contentBlocks[this.selectedContentBlockIndex] ?? null;
  }

  contentBlockOutline(block: EditorContentBlock, index: number): string {
    const prefix = `${index + 1}. ${this.contentBlockLabel(block.type)}`;

    if (block.type === "heading") {
      return `${prefix} · ${block.headingText.trim() || "Sin titulo interno"}`;
    }

    if (block.type === "quote") {
      return `${prefix} · ${block.quoteText.trim() || "Cita pendiente"}`;
    }

    if (block.type === "image") {
      return `${prefix} · ${block.imageCaption.trim() || block.imageAlt.trim() || "Foto sin leyenda"}`;
    }

    if (block.type === "embed") {
      return `${prefix} · ${block.embedTitle.trim() || this.embedFallbackLabel(block.embedUrl)}`;
    }

    return `${prefix} · ${block.text.trim() || "Parrafo vacio"}`;
  }

  previewBlocks(limit = 5): EditorContentBlock[] {
    return this.articleForm.contentBlocks.filter((block) => this.blockHasMeaningfulContent(block)).slice(0, limit);
  }

  articleWordCount(): number {
    const text = this.flattenArticleText().trim();

    if (!text) {
      return 0;
    }

    return text.split(/\s+/).length;
  }

  articleReadingTimeEstimate(): number {
    return Math.max(1, Math.ceil(this.articleWordCount() / 220));
  }

  articleDisplayTitle(): string {
    const title = this.articleForm.title.trim();

    if (title) {
      return title;
    }

    const firstHeading = this.articleBodyPreviewBlocks.find((block) => block.type === "heading" && this.extractTextContent(block.heading.text));
    return firstHeading?.type === "heading" ? this.extractTextContent(firstHeading.heading.text) : "Sin titular todavia";
  }

  articleDisplaySubtitle(): string {
    const subtitle = this.articleForm.subtitle.trim();

    if (subtitle) {
      return subtitle;
    }

    return this.articleDisplayExcerpt();
  }

  articleDisplayExcerpt(): string {
    const excerpt = this.articleForm.excerpt.trim();

    if (excerpt) {
      return excerpt;
    }

    const fallback = this.articlePreviewText().trim();
    return fallback || "La bajada, el resumen corto y la promesa de lectura apareceran aqui.";
  }

  articleDisplayCoverUrl(): string {
    const coverUrl = this.articleForm.coverUrl.trim();

    if (coverUrl) {
      return coverUrl;
    }

    const firstImage = this.articleBodyPreviewBlocks.find((block) => block.type === "image" && block.image.url.trim());
    return firstImage?.type === "image" ? firstImage.image.url.trim() : "";
  }

  articleDisplayTags(): string[] {
    return this.articleForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  articlePreviewPath(): string {
    const selectedSlug = this.selectedArticle?.slug?.trim();

    if (selectedSlug) {
      return `/articulo/${selectedSlug}`;
    }

    return `/articulo/${this.buildPreviewSlug(this.articleDisplayTitle()) || "vista-previa-editorial"}`;
  }

  articlePreviewPrimaryLabel(): string {
    if (this.articleForm.categoryId) {
      const category = this.categories.find((item) => item.id === this.articleForm.categoryId);

      if (category?.name?.trim()) {
        return category.name.trim();
      }
    }

    const firstTag = this.articleDisplayTags()[0];

    if (firstTag) {
      return this.humanizeToken(firstTag);
    }

    return this.selectedArticleId ? "Edicion en curso" : "Borrador nuevo";
  }

  articleCoverToneLabel(): string {
    if (!this.articleForm.coverUrl.trim()) {
      return "Sin portada asignada";
    }

    if (this.articleForm.coverType === "video") {
      return "Portada en video";
    }

    if (this.articleForm.coverType === "audio") {
      return "Portada en audio";
    }

    if (this.articleForm.coverType === "infographic") {
      return "Portada tipo infografia";
    }

    return "Portada en imagen";
  }

  private embedFallbackLabel(value: string): string {
    if (this.isTweetEmbedUrl(value)) {
      return "Tweet incrustado";
    }

    if (this.isInstagramEmbedUrl(value)) {
      return "Post de Instagram";
    }

    return "Embed editorial";
  }

  safeEmbedUrl(value: string): SafeResourceUrl | null {
    const resolved = resolveVideoEmbed(value);
    return resolved?.embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(resolved.embedUrl) : null;
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

  addHeadingBlock(): void {
    this.appendContentBlock("heading");
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

  captureBlockCursor(index: number, field: BlockTextField, event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;

    if (!target) {
      return;
    }

    this.selectedContentBlockIndex = index;
    this.activeBlockCursor = {
      index,
      field,
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length
    };
  }

  insertSelectedBlock(type: EditorContentBlock["type"]): void {
    if (this.insertBlockAtCursor(type)) {
      return;
    }

    const hasSelectedBlock = this.selectedContentBlockIndex >= 0 && this.selectedContentBlockIndex < this.articleForm.contentBlocks.length;

    if (hasSelectedBlock) {
      this.insertContentBlock(this.selectedContentBlockIndex, type);
      return;
    }

    this.appendContentBlock(type);
  }

  insertSelectedSubheading(): void {
    if (this.insertBlockAtCursor("heading", { headingLevel: "h3" })) {
      return;
    }

    const hasSelectedBlock = this.selectedContentBlockIndex >= 0 && this.selectedContentBlockIndex < this.articleForm.contentBlocks.length;

    if (hasSelectedBlock) {
      this.insertPreparedBlock(this.selectedContentBlockIndex + 1, this.buildContentBlock("heading", { headingLevel: "h3" }));
      return;
    }

    this.insertPreparedBlock(this.articleForm.contentBlocks.length, this.buildContentBlock("heading", { headingLevel: "h3" }));
  }

  insertParagraphBlock(afterIndex: number): void {
    this.insertContentBlock(afterIndex, "paragraph");
  }

  insertHeadingBlock(afterIndex: number): void {
    this.insertContentBlock(afterIndex, "heading");
  }

  insertSubheadingAfter(afterIndex: number): void {
    this.insertPreparedBlock(afterIndex + 1, this.buildContentBlock("heading", { headingLevel: "h3" }));
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
    this.activeBlockCursor = null;

    if (this.articleForm.contentBlocks.length === 0) {
      this.articleForm.contentBlocks = [this.createParagraphBlock()];
    }

    this.selectedContentBlockIndex = Math.max(0, Math.min(this.selectedContentBlockIndex, this.articleForm.contentBlocks.length - 1));

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
    this.activeBlockCursor = null;
    if (this.selectedContentBlockIndex === index) {
      this.selectedContentBlockIndex = nextIndex;
    }
    this.cdr.markForCheck();
  }

  private appendContentBlock(type: EditorContentBlock["type"]): void {
    this.insertContentBlock(this.articleForm.contentBlocks.length - 1, type);
  }

  private insertContentBlock(afterIndex: number, type: EditorContentBlock["type"]): void {
    this.insertPreparedBlock(afterIndex + 1, this.buildContentBlock(type));
  }

  private insertPreparedBlock(insertIndex: number, block: EditorContentBlock): void {
    const items = [...this.articleForm.contentBlocks];
    const normalizedIndex = Math.min(Math.max(insertIndex, 0), items.length);
    items.splice(normalizedIndex, 0, block);
    this.articleForm.contentBlocks = items;
    this.selectedContentBlockIndex = normalizedIndex;
    this.activeBlockCursor = null;
    this.cdr.markForCheck();
    this.focusContentBlock(normalizedIndex);
  }

  private insertBlockAtCursor(
    type: EditorContentBlock["type"],
    options?: { headingLevel?: "h2" | "h3" }
  ): boolean {
    const cursor = this.activeBlockCursor;

    if (!cursor) {
      return false;
    }

    const block = this.articleForm.contentBlocks[cursor.index];

    if (!block) {
      return false;
    }

    if (block.type !== "paragraph" || cursor.field !== "text") {
      return false;
    }

    const currentText = block.text ?? "";
    const splitIndex = Math.max(0, Math.min(cursor.start, currentText.length));
    const beforeText = currentText.slice(0, splitIndex).replace(/\s+$/, "");
    const afterText = currentText.slice(splitIndex).replace(/^\s+/, "");
    const replacement: EditorContentBlock[] = [];

    if (beforeText.trim()) {
      replacement.push(this.createParagraphBlock(beforeText));
    }

    replacement.push(this.buildContentBlock(type, options));

    if (afterText.trim()) {
      replacement.push(this.createParagraphBlock(afterText));
    }

    if (replacement.length === 1 && replacement[0].type !== "paragraph") {
      replacement.push(this.createParagraphBlock());
    }

    const insertFocusIndex = beforeText.trim() ? cursor.index + 1 : cursor.index;
    const items = [...this.articleForm.contentBlocks];
    items.splice(cursor.index, 1, ...replacement);
    this.articleForm.contentBlocks = items;
    this.selectedContentBlockIndex = insertFocusIndex;
    this.activeBlockCursor = null;
    this.cdr.markForCheck();
    this.focusContentBlock(insertFocusIndex);
    return true;
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

  private blockHasMeaningfulContent(block: EditorContentBlock): boolean {
    if (block.type === "heading") {
      return block.headingText.trim().length > 0;
    }

    if (block.type === "quote") {
      return block.quoteText.trim().length > 0;
    }

    if (block.type === "image") {
      return block.imageUrl.trim().length > 0;
    }

    if (block.type === "embed") {
      return Boolean(resolveVideoEmbed(block.embedUrl));
    }

    return block.text.trim().length > 0;
  }

  private flattenArticleText(): string {
    return this.articleBodyPlainText.trim();
  }

  private buildPreviewSlug(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
      headingText: "",
      headingAlign: "center",
      headingLevel: "h2",
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

  private createHeadingBlock(heading?: { text?: string; align?: "left" | "center" | "right"; level?: "h2" | "h3" }): EditorContentBlock {
    return {
      type: "heading",
      headingText: heading?.text ?? "",
      headingAlign: heading?.align ?? "center",
      headingLevel: heading?.level ?? "h2",
      text: "",
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
      headingText: "",
      headingAlign: "center",
      headingLevel: "h2",
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
      headingText: "",
      headingAlign: "center",
      headingLevel: "h2",
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
      headingText: "",
      headingAlign: "center",
      headingLevel: "h2",
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

  private buildContentBlock(type: EditorContentBlock["type"], options?: { headingLevel?: "h2" | "h3" }): EditorContentBlock {
    if (type === "heading") {
      return this.createHeadingBlock({ level: options?.headingLevel ?? "h2" });
    }

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
      block.type === "heading"
        ? this.createHeadingBlock(block.heading)
        : block.type === "quote"
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
    const payload = this.editorHtmlToContentBlocks(this.articleBodyHtml);
    this.syncArticleBodyPreview(payload);
    return payload;
  }

  private configureCkeditorUploadAdapter(editor: {
    plugins: {
      get: (name: string) => {
        createUploadAdapter?: (loader: CkeditorFileLoader) => EditorialImageUploadAdapter;
      };
    };
  }): void {
    const repository = editor.plugins.get("FileRepository");
    repository.createUploadAdapter = (loader: CkeditorFileLoader) =>
      new EditorialImageUploadAdapter(loader, async (file) => this.handleEditorImageUpload(file));
  }

  private async handleEditorImageUpload(file: File): Promise<{ url: string }> {
    const uploaded = await this.uploadImageFile(file, "");
    return { url: uploaded.url };
  }

  private syncArticleBodyPreview(blocks: ArticleContentBlock[]): void {
    this.articleBodyPreviewBlocks = blocks;
    this.articleBodyPlainText = this.extractTextFromBlocks(blocks);
    this.articleForm.contentBlocks = blocks.length > 0
      ? blocks.map((block) =>
          block.type === "heading"
            ? this.createHeadingBlock(block.heading)
            : block.type === "quote"
            ? this.createQuoteBlock(block.quote)
            : block.type === "image"
            ? this.createImageBlock(block.image)
            : block.type === "embed"
            ? this.createEmbedBlock(block.embed)
            : this.createParagraphBlock(block.text)
        )
      : [this.createParagraphBlock()];
    this.selectedContentBlockIndex = Math.min(this.selectedContentBlockIndex, Math.max(0, this.articleForm.contentBlocks.length - 1));
  }

  private contentBlocksToEditorHtml(blocks: ArticleContentBlock[]): string {
    if (blocks.length === 0) {
      return "<p></p>";
    }

    return blocks
      .map((block) => {
        if (block.type === "heading") {
          const level = block.heading.level === "h3" ? "h3" : "h2";
          return `<${level}>${this.blockHtmlForEditor(block.heading.text)}</${level}>`;
        }

        if (block.type === "quote") {
          const attribution = block.quote.attribution?.trim()
            ? `<p><strong>${this.escapeHtml(block.quote.attribution.trim())}</strong></p>`
            : "";
          return `<blockquote><p>${this.blockHtmlForEditor(block.quote.text)}</p>${attribution}</blockquote>`;
        }

        if (block.type === "image") {
          const caption = block.image.caption?.trim()
            ? `<figcaption>${this.escapeHtml(block.image.caption.trim())}</figcaption>`
            : "";
          return `<figure class="image"><img src="${this.escapeHtml(block.image.url)}" alt="${this.escapeHtml(block.image.alt || "")}">${caption}</figure>`;
        }

        if (block.type === "embed") {
          return `<figure class="media"><oembed url="${this.escapeHtml(block.embed.url)}"></oembed></figure>`;
        }

        return `<p>${this.blockHtmlForEditor(block.text)}</p>`;
      })
      .join("");
  }

  private blockHtmlForEditor(value: string): string {
    const source = String(value ?? "").trim();

    if (!source) {
      return "";
    }

    return this.hasRichHtml(source) ? source : renderEditorialText(source);
  }

  private editorHtmlToContentBlocks(value: string): ArticleContentBlock[] {
    const source = String(value ?? "").trim();

    if (!source) {
      return [];
    }

    const documentRoot = new DOMParser().parseFromString(`<div>${source}</div>`, "text/html");
    const wrapper = documentRoot.body.firstElementChild ?? documentRoot.body;
    const blocks: ArticleContentBlock[] = [];

    for (const node of Array.from(wrapper.childNodes)) {
      this.appendEditorNodeAsBlocks(node, blocks);
    }

    return this.removeStandaloneEmbedLinks(blocks)
      .filter((block) => this.blockHasMeaningfulPayload(block));
  }

  private removeStandaloneEmbedLinks(blocks: ArticleContentBlock[]): ArticleContentBlock[] {
    const sanitized: ArticleContentBlock[] = [];

    for (const block of blocks) {
      const previous = sanitized[sanitized.length - 1];

      if (
        block.type === "embed"
        && previous?.type === "embed"
        && previous.embed.url.trim() === block.embed.url.trim()
      ) {
        continue;
      }

      if (block.type === "paragraph") {
        const standaloneLink = this.extractStandaloneEmbedLink(block.text);

        if (standaloneLink) {
          const nextBlock = blocks[sanitized.length + 1];

          if (
            previous?.type === "embed"
            && this.sameResolvedEmbedSource(previous.embed.url, standaloneLink)
          ) {
            continue;
          }

          if (
            nextBlock?.type === "embed"
            && this.sameResolvedEmbedSource(nextBlock.embed.url, standaloneLink)
          ) {
            continue;
          }
        }
      }

      sanitized.push(block);
    }

    return sanitized;
  }

  private extractStandaloneEmbedLink(value: string): string | null {
    const plainText = this.extractTextContent(value).trim();
    const resolvedPlainText = resolveVideoEmbed(plainText);

    if (resolvedPlainText) {
      return resolvedPlainText.sourceUrl;
    }

    const documentRoot = new DOMParser().parseFromString(`<div>${value}</div>`, "text/html");
    const anchor = documentRoot.body.querySelector("a[href]");

    if (!anchor || documentRoot.body.querySelectorAll("a[href]").length !== 1) {
      return null;
    }

    const normalizedText = documentRoot.body.textContent?.replace(/\s+/g, " ").trim() ?? "";

    if (normalizedText.length === 0 || normalizedText !== anchor.textContent?.replace(/\s+/g, " ").trim()) {
      return null;
    }

    return resolveVideoEmbed(anchor.getAttribute("href") ?? "")?.sourceUrl ?? null;
  }

  private sameResolvedEmbedSource(left: string, right: string): boolean {
    const leftSource = resolveVideoEmbed(left)?.sourceUrl ?? "";
    const rightSource = resolveVideoEmbed(right)?.sourceUrl ?? "";
    return leftSource.length > 0 && leftSource === rightSource;
  }

  private appendEditorNodeAsBlocks(node: Node, blocks: ArticleContentBlock[]): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";

      if (text) {
        blocks.push({
          type: "paragraph",
          text: this.escapeHtml(text)
        });
      }

      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();

    if (tagName === "H2" || tagName === "H3") {
      const text = this.normalizeInlineHtml(element.innerHTML);

      if (text) {
        blocks.push({
          type: "heading",
          heading: {
            text,
            align: this.extractHeadingAlign(element),
            level: tagName === "H3" ? "h3" : "h2"
          }
        });
      }

      return;
    }

    if (tagName === "P") {
      const text = this.normalizeInlineHtml(element.innerHTML);

      if (text) {
        blocks.push({
          type: "paragraph",
          text
        });
      }

      return;
    }

    if (tagName === "BLOCKQUOTE") {
      const clone = element.cloneNode(true) as HTMLElement;
      const attributionElement = clone.querySelector("figcaption, footer, cite");
      const attribution = attributionElement?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      attributionElement?.remove();

      const quoteParagraphs = Array.from(clone.querySelectorAll(":scope > p"));
      const quoteSource = quoteParagraphs.length > 0
        ? quoteParagraphs.map((paragraph) => paragraph.innerHTML).join("<br>")
        : clone.innerHTML;
      const quoteText = this.normalizeInlineHtml(quoteSource);

      if (quoteText) {
        blocks.push({
          type: "quote",
          quote: {
            text: quoteText,
            attribution: attribution || undefined
          }
        });
      }

      return;
    }

    if (tagName === "UL" || tagName === "OL") {
      const ordered = tagName === "OL";
      const items = Array.from(element.children).filter((child) => child.tagName.toUpperCase() === "LI");

      items.forEach((item, index) => {
        const itemText = this.normalizeInlineHtml(item.innerHTML);

        if (!itemText) {
          return;
        }

        blocks.push({
          type: "paragraph",
          text: `${ordered ? `${index + 1}.` : "•"} ${itemText}`
        });
      });

      return;
    }

    const imageBlock = this.extractImageBlockFromElement(element);

    if (imageBlock) {
      blocks.push(imageBlock);
      return;
    }

    const embedBlock = this.extractEmbedBlockFromElement(element);

    if (embedBlock) {
      blocks.push(embedBlock);
      return;
    }

    if (["DIV", "SECTION", "ARTICLE", "MAIN", "FIGURE"].includes(tagName)) {
      for (const child of Array.from(element.childNodes)) {
        this.appendEditorNodeAsBlocks(child, blocks);
      }
      return;
    }

    const fallbackText = this.normalizeInlineHtml(element.innerHTML);

    if (fallbackText) {
      blocks.push({
        type: "paragraph",
        text: fallbackText
      });
    }
  }

  private extractImageBlockFromElement(element: Element): ArticleContentBlock | null {
    const imageElement = element.tagName.toUpperCase() === "IMG"
      ? element as HTMLImageElement
      : element.querySelector("img");
    const imageUrl = imageElement?.getAttribute("src")?.trim() ?? "";

    if (!imageUrl) {
      return null;
    }

    const captionElement = element.tagName.toUpperCase() === "FIGCAPTION"
      ? element
      : element.querySelector("figcaption");

    return {
      type: "image",
      image: {
        url: imageUrl,
        alt: imageElement?.getAttribute("alt")?.trim() ?? "",
        caption: captionElement?.textContent?.replace(/\s+/g, " ").trim() || undefined
      }
    };
  }

  private extractEmbedBlockFromElement(element: Element): ArticleContentBlock | null {
    const sourceUrl =
      element.querySelector("oembed")?.getAttribute("url")
      ?? element.querySelector("[data-oembed-url]")?.getAttribute("data-oembed-url")
      ?? element.querySelector("iframe")?.getAttribute("src")
      ?? (element.tagName.toUpperCase() === "OEMBED" ? element.getAttribute("url") : null)
      ?? (element.tagName.toUpperCase() === "IFRAME" ? element.getAttribute("src") : null)
      ?? "";
    const resolved = resolveVideoEmbed(sourceUrl ?? "");

    if (!resolved) {
      return null;
    }

    const title =
      element.querySelector("figcaption")?.textContent?.replace(/\s+/g, " ").trim()
      ?? element.getAttribute("data-caption")
      ?? "";

    return {
      type: "embed",
      embed: {
        url: resolved.sourceUrl,
        provider: resolved.provider,
        title: title || undefined
      }
    };
  }

  private normalizeInlineHtml(value: string): string {
    const source = String(value ?? "").trim();

    if (!source) {
      return "";
    }

    const documentRoot = new DOMParser().parseFromString(`<div>${source}</div>`, "text/html");
    const wrapper = documentRoot.body.firstElementChild ?? documentRoot.body;
    this.sanitizeInlineContainer(wrapper);
    return wrapper.innerHTML.replace(/>\s+</g, "><").trim();
  }

  private sanitizeInlineContainer(container: ParentNode): void {
    const allowedTags = new Set(["A", "STRONG", "B", "EM", "I", "U", "S", "DEL", "MARK", "CODE", "BR", "SUB", "SUP", "SPAN"]);

    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child);
        continue;
      }

      const element = child as HTMLElement;
      this.sanitizeInlineContainer(element);

      if (!allowedTags.has(element.tagName)) {
        while (element.firstChild) {
          element.parentNode?.insertBefore(element.firstChild, element);
        }

        element.remove();
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const keepAttribute =
          element.tagName === "A"
          && ["href", "target", "rel", "title"].includes(name);

        if (!keepAttribute) {
          element.removeAttribute(attribute.name);
        }
      }

      if (element.tagName === "A") {
        const safeHref = this.sanitizeEditorialHref(element.getAttribute("href") ?? "");

        if (!safeHref) {
          while (element.firstChild) {
            element.parentNode?.insertBefore(element.firstChild, element);
          }

          element.remove();
          continue;
        }

        element.setAttribute("href", safeHref);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }
  }

  private sanitizeEditorialHref(value: string): string {
    const normalized = value.trim();

    if (!normalized) {
      return "";
    }

    if (normalized.startsWith("mailto:")) {
      return normalized;
    }

    try {
      const url = new URL(normalized);
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch {
      return "";
    }
  }

  private renderRichEditorialContent(value: string): string {
    const source = String(value ?? "").trim();
    return this.hasRichHtml(source) ? source : renderEditorialText(source);
  }

  private hasRichHtml(value: string): boolean {
    return /<([a-z][a-z0-9]*)\b[^>]*>/i.test(value);
  }

  private extractTextContent(value: string): string {
    const source = String(value ?? "").trim();

    if (!source) {
      return "";
    }

    if (!this.hasRichHtml(source)) {
      return source.replace(/\s+/g, " ").trim();
    }

    const documentRoot = new DOMParser().parseFromString(`<div>${source}</div>`, "text/html");
    return documentRoot.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  private extractTextFromBlocks(blocks: ArticleContentBlock[]): string {
    return blocks
      .map((block) => {
        if (block.type === "heading") {
          return this.extractTextContent(block.heading.text);
        }

        if (block.type === "quote") {
          return `${this.extractTextContent(block.quote.text)} ${block.quote.attribution ?? ""}`.trim();
        }

        if (block.type === "image") {
          return `${block.image.caption ?? ""} ${block.image.alt ?? ""}`.trim();
        }

        if (block.type === "embed") {
          return block.embed.title ?? "";
        }

        return this.extractTextContent(block.text);
      })
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractHeadingAlign(element: HTMLElement): "left" | "center" | "right" {
    const align = element.style.textAlign?.trim().toLowerCase();

    if (align === "center" || align === "right") {
      return align;
    }

    return "left";
  }

  private blockHasMeaningfulPayload(block: ArticleContentBlock): boolean {
    if (block.type === "heading") {
      return this.extractTextContent(block.heading.text).length > 0;
    }

    if (block.type === "quote") {
      return this.extractTextContent(block.quote.text).length > 0;
    }

    if (block.type === "image") {
      return block.image.url.trim().length > 0;
    }

    if (block.type === "embed") {
      return Boolean(resolveVideoEmbed(block.embed.url));
    }

    return this.extractTextContent(block.text).length > 0;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
      if (block.type === "heading" && "heading" in block) {
        const text = this.extractTextContent(block.heading.text).replace(/\s+/g, " ");

        if (text) {
          firstParagraph = text;
          break;
        }
      }

      if (block.type === "paragraph" && "text" in block) {
        const text = this.extractTextContent(block.text).replace(/\s+/g, " ");

        if (text) {
          firstParagraph = text;
          break;
        }
      }

      if (block.type === "quote" && "quote" in block) {
        const text = this.extractTextContent(block.quote.text).replace(/\s+/g, " ");

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
      contentBlocks: Array<Record<string, unknown>>;
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
        contentBlocks: this.serializeContentBlocksForApi(contentBlocks),
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

  private serializeContentBlocksForApi(contentBlocks: ArticleContentBlock[]): Array<Record<string, unknown>> {
    return contentBlocks.map((block) => {
      if (block.type === "embed") {
        return {
          type: "embed",
          embed: {
            url: block.embed.url,
            title: block.embed.title ?? ""
          }
        };
      }

      return block as unknown as Record<string, unknown>;
    });
  }

  private validateArticlePayload(payload: {
    title: string;
    excerpt: string;
    contentBlocks: Array<Record<string, unknown>>;
  }): string | null {
    if (this.uploadingCover || this.hasUploadingContentBlocks()) {
      return "Espera a que terminen de subir todas las imagenes antes de guardar el articulo.";
    }

    if (payload.title.trim().length < 6) {
      return "El titulo debe tener al menos 6 caracteres.";
    }

    if (payload.contentBlocks.length === 0) {
      return "Agrega al menos un parrafo, una cita, una foto o un embed editorial al cuerpo del articulo.";
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
        return "Agrega al menos un parrafo, una cita, una foto o un embed editorial para empezar la noticia.";
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
    const articleBlocks = Array.isArray(article.contentBlocks) && article.contentBlocks.length > 0
      ? article.contentBlocks
      : article.body.map((text) => ({ type: "paragraph", text } as ArticleContentBlock));

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
    this.articleBodyHtml = this.contentBlocksToEditorHtml(articleBlocks);
    this.syncArticleBodyPreview(articleBlocks);
    this.activeArticleWorkspaceTab = "redaction";
    this.unlockedArticleStep = "review";
    this.activeArticleStep = "review";
    this.selectedContentBlockIndex = 0;
    this.editorPreviewMode = "article";
    this.editorSidebarTab = "document";
    this.cdr.markForCheck();
  }

  resetArticleForm(): void {
    this.selectedArticleId = null;
    this.selectedArticle = null;
    this.moderationNote = "";
    this.uploadingCover = false;
    this.reviewConfirmationOpen = false;
    this.articleForm = this.emptyArticleForm();
    this.articleBodyHtml = "<p></p>";
    this.syncArticleBodyPreview([]);
    this.activeArticleWorkspaceTab = "redaction";
    this.unlockedArticleStep = "body";
    this.activeArticleStep = "body";
    this.selectedContentBlockIndex = 0;
    this.editorPreviewMode = "article";
    this.editorSidebarTab = "document";
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


