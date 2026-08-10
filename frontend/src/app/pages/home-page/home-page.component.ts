import { NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";
import { ToastService } from "../../core/services/toast.service";
import { PublicArticle, SitePayload } from "../../core/types/api.types";
import { NewsCardComponent } from "../../shared/components/news-card/news-card.component";

@Component({
  selector: "app-home-page",
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, NewsCardComponent, FormsModule],
  template: `
    <section class="search-block home-search-block home-search-block--top" id="archivo-editorial" *ngIf="!filterActive">
      <form class="search-form" (ngSubmit)="runSearch()">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          name="searchTerm"
          placeholder="Buscar artículos"
          aria-label="Buscar artículos"
        />
        <button class="button button--secondary" type="submit">Buscar</button>
      </form>
      <p class="helper-text">Busca por texto o explora por etiquetas y categorías creadas por administración.</p>
      <p class="helper-text helper-text--cold-start" *ngIf="coldStartHintVisible">
        Si es tu primera visita, la carga inicial puede tardar unos segundos mientras despertamos el servidor.
      </p>
      <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
    </section>

    <section class="home-stage" *ngIf="!filterActive">
      <section class="home-focus">
        <ng-container *ngIf="homeFeatured; else featuredFallback">
          <div class="home-focus__feature">
            <div class="home-focus__copy">
              <p class="eyebrow">{{ homeFeatured.featured ? "Tema del d&iacute;a" : "Lo &uacute;ltimo" }}</p>
              <h1>{{ homeFeatured.title }}</h1>
              <p class="hero-copy">{{ homeFeatured.subtitle || homeFeatured.excerpt }}</p>
            </div>

            <ng-container *ngIf="hasVisualCover(homeFeatured); else homeFocusFallback">
              <div class="home-focus__media-shell">
                <a class="home-focus__media" [routerLink]="['/articulo', homeFeatured.slug]" [attr.aria-label]="'Abrir ' + homeFeatured.title">
                  <img
                    [src]="homeFeatured.cover.url"
                    [alt]="homeFeatured.cover.alt || homeFeatured.title"
                    [style.object-position]="featuredCoverObjectPosition(homeFeatured.cover)"
                  />
                </a>
              </div>
            </ng-container>

            <ng-template #homeFocusFallback>
              <div class="home-focus__media-shell">
                <a class="home-focus__media home-focus__media--fallback" [routerLink]="['/articulo', homeFeatured.slug]" [attr.aria-label]="'Abrir ' + homeFeatured.title">
                  <span class="hero-media__badge">{{ homeFeatured.cover.type === "audio" ? "Audio" : "Portada" }}</span>
                  <strong>{{ homeFeatured.category?.name || "Lectura principal" }}</strong>
                </a>
              </div>
            </ng-template>
            <a class="button home-focus__cta" [routerLink]="['/articulo', homeFeatured.slug]">Leer artículo completo</a>
          </div>

        </ng-container>

        <ng-template #featuredFallback>
          <div class="home-focus__empty">
            <p class="eyebrow">Portada</p>
            <h1>La portada estará lista en unos segundos.</h1>
            <p class="hero-copy">Cuando carguen los artículos publicados, aquí aparecerá la historia principal del medio.</p>
          </div>
        </ng-template>
      </section>

      <aside class="home-rail">
        <section class="home-rail-card" *ngIf="homeTimeline.length > 0">
          <div class="section-heading section-heading--compact">
            <div>
              <p class="eyebrow">Últimas</p>
              <h3>Lectura rápida</h3>
            </div>
          </div>

          <div class="home-timeline">
            <a class="home-timeline__item" *ngFor="let article of visibleHomeTimeline" [routerLink]="['/articulo', article.slug]">
              <span class="home-timeline__time">{{ formatTimelineStamp(article) }}</span>
              <span class="home-timeline__body">{{ article.title }}</span>
            </a>
          </div>

          <div class="home-rail-card__actions">
            <a class="button button--secondary" *ngIf="homeMostRead" [routerLink]="['/articulo', homeMostRead.slug]">
              Mostrar el m&aacute;s le&iacute;do
            </a>
            <button class="button button--ghost" type="button" (click)="jumpToArchive()">Ver todas las noticias</button>
          </div>
        </section>
      </aside>

      <section class="home-stage__stream">
        <section class="home-newsletter-strip">
          <div class="home-newsletter-strip__copy">
            <p class="eyebrow">Bolet&iacute;n editorial</p>
            <h3>Recibe nuevas publicaciones sin ruido visual.</h3>
            <p class="home-sidebrand__microcopy">Un correo. Cero ruido. Solo contexto cuando haya algo que valga la pena leer.</p>
          </div>

          <form class="home-newsletter-strip__form" (ngSubmit)="subscribe()">
            <input
              type="text"
              [(ngModel)]="subscriptionForm.name"
              name="homeNewsletterName"
              placeholder="Nombre"
              [disabled]="submittingSubscription"
              required
            />
            <input
              type="email"
              [(ngModel)]="subscriptionForm.email"
              name="homeNewsletterEmail"
              placeholder="Correo"
              [disabled]="submittingSubscription"
              required
            />
            <button class="button" type="submit" [disabled]="submittingSubscription">
              {{ submittingSubscription ? "Enviando..." : "Suscribirme" }}
            </button>
            <p class="helper-text home-newsletter-strip__message" *ngIf="subscriptionMessage">{{ subscriptionMessage }}</p>
          </form>
        </section>

        <div class="home-stage__stream-divider" aria-hidden="true"></div>

        <section class="feature-strip">
          <article class="feature-note">
            <p class="eyebrow">Verdad pública</p>
            <h3 class="feature-note__quote">Estamos aca contra todo pronostico, contra los de siempre.</h3>
            <p class="feature-note__author">Gustavo Petro</p>
          </article>
          <article class="feature-note">
            <p class="eyebrow">Pais en paz</p>
            <h3 class="feature-note__quote">Creo que si uno vive en este pais tiene una tarea fundamental: transformarlo.</h3>
            <p class="feature-note__author">Jaime Garzon</p>
          </article>
          <article class="feature-note">
            <p class="eyebrow">Ideas firmes</p>
            <h3 class="feature-note__quote">El pueblo es superior a sus dirigentes.</h3>
            <p class="feature-note__author">Jorge E. Gaitan</p>
          </article>
        </section>

        <div class="home-stage__stream-divider" aria-hidden="true"></div>

        <section class="section-block home-stage__recent" id="portada-reciente" [class.is-highlighted]="recentSectionHighlighted">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Portada reciente</p>
              <h2>Más lecturas del archivo cercano</h2>
              <p class="helper-text home-stage__recent-summary" *ngIf="homeRecentTotal > 0">
                Mostrando {{ homeRecent.length }} de {{ homeRecentTotal }} publicaciones.
              </p>
            </div>
          </div>

          <div class="cards-grid">
            <app-news-card *ngFor="let article of homeRecent" [article]="article" variant="compact"></app-news-card>
          </div>
          <div class="button-row home-stage__recent-actions" *ngIf="homeRecent.length > 0">
            <button
              class="button button--secondary"
              type="button"
              *ngIf="canLoadMoreHomeRecent()"
              (click)="loadMoreHomeRecent()"
              [disabled]="loadingMoreRecent"
            >
              {{ loadingMoreRecent ? "Cargando..." : "Cargar más" }}
            </button>
            <p class="helper-text home-stage__recent-actions-note" *ngIf="!canLoadMoreHomeRecent() && homeRecentTotal > 0">
              Ya estás viendo todas las publicaciones disponibles en esta portada.
            </p>
          </div>
          <p class="empty-state" *ngIf="loading">Cargando portada...</p>
          <p class="empty-state" *ngIf="!loading && homeRecent.length === 0">Todavía no hay más artículos para mostrar.</p>
        </section>
      </section>
    </section>

    <section class="search-block home-search-block" id="archivo-editorial" *ngIf="filterActive">
      <form class="search-form" (ngSubmit)="runSearch()">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          name="searchTerm"
          placeholder="Buscar artículos"
          aria-label="Buscar artículos"
        />
        <button class="button button--secondary" type="submit">Buscar</button>
        <button class="button button--ghost" type="button" (click)="clearSearch()">Limpiar</button>
      </form>
      <p class="helper-text">Busca por texto o explora por etiquetas y categorías creadas por administración.</p>
      <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
    </section>

    <section class="section-block" *ngIf="filterActive">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Exploración</p>
          <h2>{{ activeResultsTitle }}</h2>
          <p class="helper-text">{{ activeResultsDescription }}</p>
        </div>
        <button class="button button--ghost" type="button" (click)="clearSearch()">Volver a portada</button>
      </div>

      <div class="tag-row" *ngIf="searchTerm || activeTag || activeCategory">
        <span class="tag" *ngIf="searchTerm">Búsqueda: {{ searchTerm }}</span>
        <span class="tag tag--interactive" *ngIf="activeTag">Etiqueta: {{ humanize(activeTag) }}</span>
        <span class="tag tag--category" *ngIf="activeCategory">Categoría: {{ humanize(activeCategory) }}</span>
      </div>

      <div class="cards-grid">
        <app-news-card *ngFor="let article of searchResults" [article]="article"></app-news-card>
      </div>
      <p class="empty-state" *ngIf="loading">Actualizando selección editorial...</p>
      <p class="empty-state" *ngIf="searchResults.length === 0 && !loading">No hay artículos publicados para este filtro.</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private requestId = 0;
  private readonly timelineTimeFormatter = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });
  private readonly timelineDateFormatter = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short"
  });
  private readonly homeRecentPageSize = 9;

  site: SitePayload | null = null;
  homeFeatured: PublicArticle | null = null;
  homeMostRead: PublicArticle | null = null;
  homeTimeline: PublicArticle[] = [];
  visibleHomeTimeline: PublicArticle[] = [];
  homeRecent: PublicArticle[] = [];
  homeRecentPage = 0;
  homeRecentTotal = 0;
  homeRecentTotalPages = 0;
  loadingMoreRecent = false;
  searchResults: PublicArticle[] = [];
  searchTerm = "";
  filterActive = false;
  activeTag = "";
  activeCategory = "";
  activeResultsTitle = "Selecciones editoriales";
  activeResultsDescription = "Explora artículos relacionados con el tema actual.";
  loading = false;
  coldStartHintVisible = false;
  errorMessage = "";
  subscriptionMessage = "";
  submittingSubscription = false;
  recentSectionHighlighted = false;
  private coldStartShowTimer: ReturnType<typeof setTimeout> | null = null;
  private coldStartHideTimer: ReturnType<typeof setTimeout> | null = null;
  private coldStartHintDismissed = false;
  private recentHighlightTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly homeTimelineWindowSize = 3;
  subscriptionForm = {
    name: "",
    email: "",
    plan: "newsletter" as const
  };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const search = params.get("search")?.trim() ?? "";
      const tag = params.get("tag")?.trim() ?? "";
      const category = params.get("category")?.trim() ?? "";
      void this.loadView(search, tag, category);
    });
  }

  hasVisualCover(article: PublicArticle): boolean {
    return article.cover.type === "image" || article.cover.type === "infographic";
  }

  coverObjectPosition(cover: PublicArticle["cover"]): string {
    return `${cover.positionX ?? 50}% ${cover.positionY ?? 50}%`;
  }

  featuredCoverObjectPosition(cover: PublicArticle["cover"]): string {
    return `${cover.positionX ?? 50}% 0%`;
  }

  articleDateLabel(article: PublicArticle): string {
    const value = this.articleDateSource(article);

    if (!value) {
      return "Fecha editorial";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Fecha editorial" : this.timelineDateFormatter.format(date);
  }

  formatTimelineStamp(article: PublicArticle): string {
    const value = this.articleDateSource(article);

    if (!value) {
      return "--:--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return this.isSameCalendarDay(date, new Date())
      ? this.timelineTimeFormatter.format(date).toLowerCase()
      : this.timelineDateFormatter.format(date);
  }

  private articleDateSource(article: PublicArticle): string | null {
    return article.publishedAt || article.updatedAt || null;
  }

  private isSameCalendarDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
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

  humanize(value: string): string {
    return value
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  async loadView(search: string, tag: string, category: string): Promise<void> {
    const requestId = ++this.requestId;

    this.loading = true;
    this.errorMessage = "";
    this.searchTerm = search;
    this.activeTag = tag;
    this.activeCategory = category;
    this.filterActive = Boolean(search || tag || category);
    this.updateColdStartHintState(requestId);
    this.cdr.markForCheck();

    try {
      if (this.filterActive) {
        const response = await this.publicApi.searchArticles({
          search,
          tag,
          category
        });

        if (requestId !== this.requestId) {
          return;
        }

        this.searchResults = response.items;
        this.activeResultsTitle = this.buildResultsTitle(search, tag, category);
        this.activeResultsDescription = this.buildResultsDescription(search, tag, category);
        this.seo.setNoIndex(`${this.activeResultsTitle} | Colombiano Promedio`, this.activeResultsDescription);
        return;
      }

      const site = await this.publicApi.getSite();

      if (requestId !== this.requestId) {
        return;
      }

      this.site = site;
      this.searchResults = [];
      this.activeResultsTitle = "Selecciones editoriales";
      this.activeResultsDescription = "Explora artículos relacionados con el tema actual.";
      this.syncHomeCollections();
      await this.loadHomeRecentPage(1, true, requestId);
      this.seo.setHome({
        description: this.homeFeatured?.excerpt || "Lecturas, archivo editorial y nuevas publicaciones en Colombiano Promedio.",
        imageUrl: this.homeFeatured?.cover.url
      });
    } catch {
      if (requestId !== this.requestId) {
        return;
      }

      this.errorMessage = this.filterActive
        ? "No fue posible cargar esta selección editorial."
        : "No fue posible cargar la portada.";
      this.clearColdStartHint();
      if (this.filterActive) {
        this.seo.setNoIndex(`${this.activeResultsTitle} | Colombiano Promedio`, this.activeResultsDescription || this.errorMessage);
      } else {
        this.errorMessage = "";
        this.seo.setHome();
      }
    } finally {
      if (requestId === this.requestId) {
        this.loading = false;
        this.clearColdStartHint();
        this.cdr.markForCheck();
      }
    }
  }

  private syncHomeCollections(): void {
    this.homeFeatured = this.site?.featured ?? this.site?.latest?.[0] ?? null;
    this.homeMostRead = this.site?.mostRead ?? this.findMostInteractedArticle(this.site?.latest ?? []);
  }

  private syncHomeRecentCollections(): void {
    const byRecency = [...this.homeRecent].sort((left, right) => this.compareByRecency(right, left));
    this.homeRecent = byRecency;
    this.homeTimeline = byRecency.slice(0, this.homeTimelineWindowSize);
    this.visibleHomeTimeline = [...this.homeTimeline];
  }

  jumpToArchive(): void {
    void this.router.navigate(["/archivo"]);
  }

  canLoadMoreHomeRecent(): boolean {
    return this.homeRecentPage < this.homeRecentTotalPages;
  }

  async loadMoreHomeRecent(): Promise<void> {
    if (this.loadingMoreRecent || !this.canLoadMoreHomeRecent()) {
      return;
    }

    this.loadingMoreRecent = true;
    this.cdr.markForCheck();

    try {
      await this.loadHomeRecentPage(this.homeRecentPage + 1, false, this.requestId);
    } catch (error) {
      this.toast.error(this.readError(error, "No fue posible cargar más artículos del archivo."));
    } finally {
      this.loadingMoreRecent = false;
      this.cdr.markForCheck();
    }
  }

  jumpToRecentArticles(): void {
    const target = document.getElementById("portada-reciente");

    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    this.recentSectionHighlighted = true;

    if (this.recentHighlightTimer) {
      clearTimeout(this.recentHighlightTimer);
    }

    this.recentHighlightTimer = setTimeout(() => {
      this.recentSectionHighlighted = false;
      this.cdr.markForCheck();
    }, 2200);

    this.cdr.markForCheck();
  }

  private async loadHomeRecentPage(page: number, replace: boolean, requestId: number): Promise<void> {
    const response = await this.publicApi.searchArticles({
      page,
      limit: this.homeRecentPageSize,
      excludeId: this.homeFeatured?.id
    });

    if (requestId !== this.requestId) {
      return;
    }

    const incomingItems = response.items.filter((article) => article.id !== this.homeFeatured?.id);

    this.homeRecent = replace
      ? incomingItems
      : [
          ...this.homeRecent,
          ...incomingItems.filter((article) => !this.homeRecent.some((existing) => existing.id === article.id))
        ];
    this.homeRecentPage = response.pagination.page;
    this.homeRecentTotal = response.pagination.total;
    this.homeRecentTotalPages = response.pagination.totalPages;
    this.syncHomeRecentCollections();
  }

  private compareByRecency(left: PublicArticle, right: PublicArticle): number {
    const leftTime = new Date(this.articleDateSource(left) ?? 0).getTime();
    const rightTime = new Date(this.articleDateSource(right) ?? 0).getTime();
    return leftTime - rightTime;
  }

  private findMostInteractedArticle(articles: PublicArticle[]): PublicArticle | null {
    if (articles.length === 0) {
      return null;
    }

    return [...articles].sort((left, right) => {
      const leftScore = (left.metrics?.views ?? 0) + (left.metrics?.shares ?? 0) + (left.metrics?.reactions ?? 0);
      const rightScore = (right.metrics?.views ?? 0) + (right.metrics?.shares ?? 0) + (right.metrics?.reactions ?? 0);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return this.compareByRecency(right, left);
    })[0] ?? null;
  }

  private updateColdStartHintState(requestId: number): void {
    if (this.filterActive || this.site || this.coldStartHintDismissed) {
      this.clearColdStartHint();
      return;
    }

    this.clearColdStartHint();

    this.coldStartShowTimer = setTimeout(() => {
      if (requestId !== this.requestId || !this.loading || this.filterActive || this.site || this.coldStartHintDismissed) {
        return;
      }

      this.coldStartHintVisible = true;
      this.cdr.markForCheck();

      this.coldStartHideTimer = setTimeout(() => {
        if (requestId !== this.requestId) {
          return;
        }

        this.coldStartHintVisible = false;
        this.coldStartHintDismissed = true;
        this.cdr.markForCheck();
      }, 12000);
    }, 1800);
  }

  private clearColdStartHint(): void {
    if (this.coldStartShowTimer) {
      clearTimeout(this.coldStartShowTimer);
      this.coldStartShowTimer = null;
    }

    if (this.coldStartHideTimer) {
      clearTimeout(this.coldStartHideTimer);
      this.coldStartHideTimer = null;
    }

    this.coldStartHintVisible = false;
  }

  async runSearch(): Promise<void> {
    const query = this.searchTerm.trim();

    if (!query) {
      this.clearSearch();
      return;
    }

    await this.router.navigate(["/"], {
      queryParams: {
        search: query,
        tag: null,
        category: null
      }
    });
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.errorMessage = "";
    void this.router.navigate(["/"], {
      queryParams: {
        search: null,
        tag: null,
        category: null
      }
    });
  }

  buildResultsTitle(search: string, tag: string, category: string): string {
    if (category) {
      return `Categoría: ${this.humanize(category)}`;
    }

    if (tag) {
      return `Etiqueta: ${this.humanize(tag)}`;
    }

    if (search) {
      return `Coincidencias para "${search}"`;
    }

    return "Selecciones editoriales";
  }

  buildResultsDescription(search: string, tag: string, category: string): string {
    if (category) {
      return "Mostrando todas las publicaciones asociadas a esta categoría editorial.";
    }

    if (tag) {
      return "Mostrando todas las publicaciones marcadas con esta etiqueta.";
    }

    if (search) {
      return "Mostrando resultados por coincidencia de título, cuerpo y etiquetas.";
    }

    return "Explora artículos relacionados con el tema actual.";
  }

  async subscribe(): Promise<void> {
    this.errorMessage = "";
    this.subscriptionMessage = "";
    this.submittingSubscription = true;

    try {
      const response = await this.publicApi.subscribe({
        name: this.subscriptionForm.name,
        email: this.subscriptionForm.email,
        plan: this.subscriptionForm.plan,
        interests: []
      });

      this.subscriptionMessage = response.message;
      this.toast.success(response.message);
      this.subscriptionForm = {
        name: "",
        email: "",
        plan: "newsletter"
      };
    } catch (error) {
      this.toast.error(this.readError(error, "No fue posible registrar la suscripción."));
    } finally {
      this.submittingSubscription = false;
      this.cdr.markForCheck();
    }
  }
}
