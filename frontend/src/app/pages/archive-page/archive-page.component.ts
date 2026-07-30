import { NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";
import { PaginationMeta, PublicArticle } from "../../core/types/api.types";
import { NewsCardComponent } from "../../shared/components/news-card/news-card.component";

@Component({
  selector: "app-archive-page",
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink, NewsCardComponent],
  template: `
    <section class="search-block archive-search">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{{ archiveEyebrow }}</p>
          <h1>{{ archiveTitle }}</h1>
          <p class="hero-copy">{{ archiveDescription }}</p>
        </div>
        <div class="button-row">
          <a class="button button--ghost" routerLink="/">Volver a portada</a>
        </div>
      </div>

      <form class="search-form" (ngSubmit)="runSearch()">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          name="archiveSearchTerm"
          placeholder="Buscar artículos"
          aria-label="Buscar artículos"
        />
        <button class="button button--secondary" type="submit">Buscar</button>
        <button class="button button--ghost" type="button" *ngIf="searchTerm || activeTag || activeCategory" (click)="clearSearch()">
          Limpiar
        </button>
      </form>

      <p class="helper-text">Explora todas las publicaciones del medio o filtra por texto, etiqueta y categoría.</p>
      <div class="tag-row" *ngIf="searchTerm || activeTag || activeCategory">
        <span class="tag" *ngIf="searchTerm">Búsqueda: {{ searchTerm }}</span>
        <span class="tag tag--interactive" *ngIf="activeTag">Etiqueta: {{ humanize(activeTag) }}</span>
        <span class="tag tag--category" *ngIf="activeCategory">Categoría: {{ humanize(activeCategory) }}</span>
      </div>
      <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
    </section>

    <section class="section-block archive-shell">
      <div class="section-heading" *ngIf="!loading || articles.length > 0">
        <div>
          <p class="helper-text" *ngIf="pagination.total > 0">Página {{ pagination.page }} de {{ pagination.totalPages }} | {{ pagination.total }} publicaciones</p>
        </div>
      </div>

      <div class="cards-grid" *ngIf="articles.length > 0">
        <app-news-card *ngFor="let article of articles" [article]="article" [filterRoute]="'/archivo'"></app-news-card>
      </div>

      <p class="empty-state" *ngIf="loading">Cargando archivo...</p>
      <p class="empty-state" *ngIf="!loading && articles.length === 0">{{ emptyStateMessage }}</p>

      <div class="button-row archive-shell__actions" *ngIf="pagination.totalPages > 1">
        <button class="button button--ghost" type="button" (click)="changePage(pagination.page - 1)" [disabled]="pagination.page <= 1">
          Anterior
        </button>
        <button class="button button--ghost" type="button" (click)="changePage(pagination.page + 1)" [disabled]="pagination.page >= pagination.totalPages">
          Siguiente
        </button>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArchivePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private requestId = 0;

  articles: PublicArticle[] = [];
  searchTerm = "";
  activeTag = "";
  activeCategory = "";
  errorMessage = "";
  loading = false;
  pagination: PaginationMeta = {
    page: 1,
    limit: 9,
    total: 0,
    totalPages: 1
  };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      void this.loadArchive();
    });
  }

  get archiveEyebrow(): string {
    if (this.activeCategory) {
      return "Categoría";
    }

    if (this.activeTag) {
      return "Etiqueta";
    }

    if (this.searchTerm) {
      return "Búsqueda";
    }

    return "Archivo";
  }

  get archiveTitle(): string {
    if (this.activeCategory) {
      return `Categoría: ${this.humanize(this.activeCategory)}`;
    }

    if (this.activeTag) {
      return `Etiqueta: ${this.humanize(this.activeTag)}`;
    }

    if (this.searchTerm) {
      return `Coincidencias para "${this.searchTerm}"`;
    }

    return "Ver todas las noticias";
  }

  get archiveDescription(): string {
    if (this.activeCategory) {
      return "Todas las publicaciones asociadas a esta categoría editorial, ordenadas de la más reciente a la más antigua.";
    }

    if (this.activeTag) {
      return "Todas las publicaciones marcadas con esta etiqueta dentro del archivo público.";
    }

    if (this.searchTerm) {
      return "Resultados del archivo público por coincidencia en título, cuerpo, extracto y etiquetas.";
    }

    return "Archivo completo de Colombiano Promedio con navegación por páginas y acceso a todas las publicaciones.";
  }

  get emptyStateMessage(): string {
    return this.searchTerm || this.activeTag || this.activeCategory
      ? "No hay artículos publicados para este filtro."
      : "Todavía no hay artículos publicados en el archivo.";
  }

  humanize(value: string): string {
    return value
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  async runSearch(): Promise<void> {
    const query = this.searchTerm.trim();

    await this.router.navigate(["/archivo"], {
      queryParams: {
        search: query || null,
        tag: null,
        category: null,
        page: null
      }
    });
  }

  async clearSearch(): Promise<void> {
    this.searchTerm = "";
    await this.router.navigate(["/archivo"], {
      queryParams: {
        search: null,
        tag: null,
        category: null,
        page: null
      }
    });
  }

  async changePage(page: number): Promise<void> {
    if (page < 1 || page > this.pagination.totalPages || page === this.pagination.page) {
      return;
    }

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page
      },
      queryParamsHandling: "merge"
    });
  }

  private async loadArchive(): Promise<void> {
    const requestId = ++this.requestId;
    const search = this.route.snapshot.queryParamMap.get("search")?.trim() ?? "";
    const tag = this.route.snapshot.queryParamMap.get("tag")?.trim() ?? "";
    const category = this.route.snapshot.queryParamMap.get("category")?.trim() ?? "";
    const page = Math.max(Number(this.route.snapshot.queryParamMap.get("page") ?? "1"), 1);

    this.loading = true;
    this.errorMessage = "";
    this.searchTerm = search;
    this.activeTag = tag;
    this.activeCategory = category;
    this.cdr.markForCheck();

    try {
      const response = await this.publicApi.searchArticles({
        search,
        tag,
        category,
        page,
        limit: this.pagination.limit
      });

      if (requestId !== this.requestId) {
        return;
      }

      if (response.pagination.totalPages > 0 && page > response.pagination.totalPages) {
        await this.changePage(response.pagination.totalPages);
        return;
      }

      this.articles = response.items;
      this.pagination = {
        ...response.pagination,
        totalPages: Math.max(response.pagination.totalPages, 1)
      };
      this.updateSeo();
    } catch {
      if (requestId !== this.requestId) {
        return;
      }

      this.articles = [];
      this.errorMessage = "No fue posible cargar el archivo público.";
      this.seo.setNoIndex("Archivo no disponible | Colombiano Promedio", this.errorMessage);
    } finally {
      if (requestId === this.requestId) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private updateSeo(): void {
    if (this.searchTerm || this.activeTag || this.activeCategory) {
      this.seo.setNoIndex(`${this.archiveTitle} | Archivo | Colombiano Promedio`, this.archiveDescription);
      return;
    }

    this.seo.setArchive({
      page: this.pagination.page
    });
  }
}
