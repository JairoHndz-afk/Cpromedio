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
    <section class="hero" *ngIf="!filterActive && site?.featured as featured">
      <div class="hero-copy-block">
        <p class="eyebrow">Lo último</p>
        <h1>{{ featured.title }}</h1>
        <p class="hero-copy">{{ featured.subtitle || featured.excerpt }}</p>
        <div class="hero-actions">
          <a class="button" [routerLink]="['/articulo', featured.slug]">Leer artículo</a>
        </div>
      </div>

      <ng-container *ngIf="hasVisualCover(featured); else heroFallback">
        <a class="hero-media" [routerLink]="['/articulo', featured.slug]" [attr.aria-label]="'Abrir ' + featured.title">
          <img
            [src]="featured.cover.url"
            [alt]="featured.cover.alt || featured.title"
            [style.object-position]="coverObjectPosition(featured.cover)"
          />
        </a>
      </ng-container>
      <ng-template #heroFallback>
        <a class="hero-media hero-media--fallback" [routerLink]="['/articulo', featured.slug]" [attr.aria-label]="'Abrir ' + featured.title">
          <span class="hero-media__badge">{{ featured.cover.type === "audio" ? "Audio" : "Portada" }}</span>
          <strong>{{ featured.category?.name || "Lectura principal" }}</strong>
          <span>Abrir artículo</span>
        </a>
      </ng-template>
    </section>

    <section class="feature-strip" *ngIf="!filterActive">
      <article class="feature-note">
        <p class="eyebrow">Verdad pública</p>
        <h3 class="feature-note__quote">Estamos acá contra todo pronóstico, contra los de siempre.</h3>
        <p class="feature-note__author">Gustavo Petro</p>
      </article>
      <article class="feature-note">
        <p class="eyebrow">País en paz</p>
        <h3 class="feature-note__quote">Creo que si uno vive en este país tiene una tarea fundamental: transformarlo.</h3>
        <p class="feature-note__author">Jaime Garzón</p>
      </article>
      <article class="feature-note">
        <p class="eyebrow">Ideas firmes</p>
        <h3 class="feature-note__quote">El pueblo es superior a sus dirigentes.</h3>
        <p class="feature-note__author">Jorge E. Gaitán</p>
      </article>
    </section>

    <section class="search-block">
      <form class="search-form" (ngSubmit)="runSearch()">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          name="searchTerm"
          placeholder="Buscar artículos"
          aria-label="Buscar artículos"
        />
        <button class="button button--secondary" type="submit">Buscar</button>
        <button class="button button--ghost" type="button" *ngIf="filterActive" (click)="clearSearch()">Limpiar</button>
      </form>
      <p class="helper-text">Busca por texto o explora por etiquetas y categorías creadas por administración.</p>
      <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
    </section>

    <section class="section-block" *ngIf="filterActive; else latestArticles">
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

    <ng-template #latestArticles>
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Últimos artículos</p>
            <h2>Portada reciente</h2>
          </div>
        </div>

        <div class="cards-grid">
          <app-news-card *ngFor="let article of site?.latest || []" [article]="article"></app-news-card>
        </div>
        <p class="empty-state" *ngIf="loading">Cargando portada...</p>
      </section>
    </ng-template>

    <section class="subscribe-block">
      <div>
        <p class="eyebrow">Boletín</p>
        <h2>Recibe nuevas publicaciones sin saturación visual.</h2>
      </div>
      <form class="inline-form" (ngSubmit)="subscribe()">
        <input
          type="text"
          [(ngModel)]="subscriptionForm.name"
          name="subscriberName"
          placeholder="Nombre"
          [disabled]="submittingSubscription"
          required
        />
        <input
          type="email"
          [(ngModel)]="subscriptionForm.email"
          name="subscriberEmail"
          placeholder="Correo"
          [disabled]="submittingSubscription"
          required
        />
        <button class="button" type="submit" [disabled]="submittingSubscription">
          {{ submittingSubscription ? "Enviando..." : "Suscribirme" }}
        </button>
      </form>
      <p class="helper-text">Solo enviamos novedades editoriales y alertas de nuevas publicaciones.</p>
      <p class="helper-text" *ngIf="subscriptionMessage">{{ subscriptionMessage }}</p>
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

  site: SitePayload | null = null;
  searchResults: PublicArticle[] = [];
  searchTerm = "";
  filterActive = false;
  activeTag = "";
  activeCategory = "";
  activeResultsTitle = "Selecciones editoriales";
  activeResultsDescription = "Explora artículos relacionados con el tema actual.";
  loading = false;
  errorMessage = "";
  subscriptionMessage = "";
  submittingSubscription = false;
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
      this.seo.setHome({
        description: site.featured?.excerpt || "Lecturas, archivo editorial y nuevas publicaciones en Colombiano Promedio.",
        imageUrl: site.featured?.cover.url
      });
    } catch {
      if (requestId !== this.requestId) {
        return;
      }

      this.errorMessage = this.filterActive
        ? "No fue posible cargar esta selección editorial."
        : "No fue posible cargar la portada.";
      this.seo.setNoIndex("Portada no disponible | Colombiano Promedio", this.errorMessage);
    } finally {
      if (requestId === this.requestId) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
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
