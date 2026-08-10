import { NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";
import {
  PaginationMeta,
  PublicArchiveFilterCategory,
  PublicArchiveFilterTag,
  PublicArticle,
  PublicArticleSort
} from "../../core/types/api.types";
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
        <div class="button-row archive-search__actions">
          <button
            class="button button--ghost archive-button archive-button--toggle"
            type="button"
            [class.is-active]="advancedFiltersVisible"
            (click)="toggleAdvancedFilters()"
          >
            {{ advancedFiltersVisible ? "Ocultar filtros" : "Filtros avanzados" }}
          </button>
          <a class="button button--ghost archive-button archive-button--subtle" routerLink="/">Ir a portada</a>
        </div>
      </div>

      <form class="search-form archive-search__form" (ngSubmit)="runSearch()">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          name="archiveSearchTerm"
          placeholder="Buscar articulos"
          aria-label="Buscar articulos"
        />
        <div class="button-row archive-search__cta-row">
          <button class="button button--secondary archive-button archive-button--submit" type="submit">Buscar</button>
          <button
            class="button button--ghost archive-button archive-button--clear"
            type="button"
            *ngIf="hasActiveFilters || hasDraftFilters"
            (click)="clearFilters()"
          >
            Limpiar
          </button>
        </div>
      </form>

      <p class="helper-text archive-search__summary">Explora todas las publicaciones del medio o afina el archivo por texto, categoria, etiqueta y orden.</p>

      <div class="archive-advanced" *ngIf="advancedFiltersVisible">
        <div class="archive-advanced__grid">
          <label class="archive-advanced__field" *ngIf="showCategoryFilter">
            <span>Categoria</span>
            <select [(ngModel)]="selectedCategory" name="archiveCategory">
              <option value="">Todas las categorias</option>
              <option *ngFor="let category of availableCategories" [value]="category.slug">{{ category.name }} ({{ category.count }})</option>
            </select>
          </label>

          <label class="archive-advanced__field">
            <span>Etiqueta</span>
            <input
              type="text"
              [(ngModel)]="selectedTag"
              name="archiveTag"
              placeholder="Ej. seguridad, opinion, cultura"
              aria-label="Filtrar por etiqueta"
            />
          </label>

          <label class="archive-advanced__field">
            <span>Orden</span>
            <select [(ngModel)]="selectedSort" name="archiveSort">
              <option *ngFor="let option of sortOptions" [value]="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>

        <div class="button-row archive-advanced__actions">
          <button class="button button--secondary archive-button archive-button--apply" type="button" (click)="applyAdvancedFilters()">
            Aplicar filtros
          </button>
          <button
            class="button button--ghost archive-button archive-button--reset"
            type="button"
            *ngIf="hasActiveFilters || hasDraftFilters"
            (click)="clearFilters()"
          >
            Reiniciar archivo
          </button>
        </div>

        <div class="archive-advanced__suggestions" *ngIf="availableTags.length > 0">
          <p class="helper-text">Etiquetas sugeridas del archivo</p>
          <div class="tag-row archive-advanced__tag-row">
            <button class="tag tag--interactive" type="button" *ngFor="let tag of availableTags" (click)="useSuggestedTag(tag.value)">
              {{ tag.label }} ({{ tag.count }})
            </button>
          </div>
        </div>

        <p class="helper-text" *ngIf="loadingFilters">Cargando sugerencias del archivo...</p>
        <p class="error-text" *ngIf="filtersErrorMessage">{{ filtersErrorMessage }}</p>
      </div>

      <div class="tag-row archive-search__active-filters" *ngIf="hasActiveFilters">
        <span class="tag" *ngIf="activeSearchTerm">Busqueda: {{ activeSearchTerm }}</span>
        <span class="tag tag--interactive" *ngIf="activeTag">Etiqueta: {{ humanize(activeTag) }}</span>
        <span class="tag tag--category" *ngIf="activeCategory">Categoria: {{ humanize(activeCategory) }}</span>
        <span class="tag" *ngIf="activeSort !== 'latest'">Orden: {{ sortLabel(activeSort) }}</span>
      </div>

      <p class="error-text" *ngIf="errorMessage">{{ errorMessage }}</p>
    </section>

    <section class="section-block archive-shell">
      <div class="section-heading" *ngIf="!loading || articles.length > 0">
        <div>
          <p class="helper-text archive-shell__meta" *ngIf="pagination.total > 0">Pagina {{ pagination.page }} de {{ pagination.totalPages }} | {{ pagination.total }} publicaciones</p>
        </div>
      </div>

      <div class="cards-grid" *ngIf="articles.length > 0">
        <app-news-card *ngFor="let article of articles" [article]="article" [filterRoute]="'/archivo'"></app-news-card>
      </div>

      <p class="empty-state" *ngIf="loading">Cargando archivo...</p>
      <p class="empty-state" *ngIf="!loading && articles.length === 0">{{ emptyStateMessage }}</p>

      <div class="button-row archive-shell__actions" *ngIf="pagination.totalPages > 1">
        <button
          class="button button--ghost archive-button archive-button--pager"
          type="button"
          (click)="changePage(pagination.page - 1)"
          [disabled]="pagination.page <= 1"
        >
          Anterior
        </button>
        <span class="archive-shell__status-pill">Pagina {{ pagination.page }} de {{ pagination.totalPages }}</span>
        <button
          class="button button--ghost archive-button archive-button--pager"
          type="button"
          (click)="changePage(pagination.page + 1)"
          [disabled]="pagination.page >= pagination.totalPages"
        >
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
  private archiveFiltersLoaded = false;
  private archiveFiltersSupported = true;

  readonly sortOptions: Array<{ value: PublicArticleSort; label: string }> = [
    { value: "latest", label: "Mas recientes" },
    { value: "popular", label: "Mas leidas" },
    { value: "oldest", label: "Mas antiguas" }
  ];

  articles: PublicArticle[] = [];
  availableCategories: PublicArchiveFilterCategory[] = [];
  availableTags: PublicArchiveFilterTag[] = [];
  searchTerm = "";
  activeSearchTerm = "";
  selectedTag = "";
  selectedCategory = "";
  selectedSort: PublicArticleSort = "latest";
  activeTag = "";
  activeCategory = "";
  activeSort: PublicArticleSort = "latest";
  errorMessage = "";
  filtersErrorMessage = "";
  loading = false;
  loadingFilters = false;
  advancedFiltersVisible = false;
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

  get hasActiveFilters(): boolean {
    return Boolean(this.activeSearchTerm || this.activeTag || this.activeCategory || this.activeSort !== "latest");
  }

  get hasDraftFilters(): boolean {
    return Boolean(this.searchTerm.trim() || this.selectedTag.trim() || this.selectedCategory || this.selectedSort !== "latest");
  }

  get showCategoryFilter(): boolean {
    return Boolean(this.availableCategories.length > 0 || this.activeCategory || this.selectedCategory);
  }

  get archiveEyebrow(): string {
    if (this.activeCategory) {
      return "Categoria";
    }

    if (this.activeTag) {
      return "Etiqueta";
    }

    if (this.activeSearchTerm) {
      return "Busqueda";
    }

    if (this.activeSort === "popular") {
      return "Tendencias";
    }

    return "Archivo";
  }

  get archiveTitle(): string {
    if (this.activeCategory) {
      return `Categoria: ${this.humanize(this.activeCategory)}`;
    }

    if (this.activeTag) {
      return `Etiqueta: ${this.humanize(this.activeTag)}`;
    }

    if (this.activeSearchTerm) {
      return `Coincidencias para "${this.activeSearchTerm}"`;
    }

    if (this.activeSort === "popular") {
      return "Noticias mas leidas";
    }

    if (this.activeSort === "oldest") {
      return "Archivo desde las primeras publicaciones";
    }

    return "Ver todas las noticias";
  }

  get archiveDescription(): string {
    if (this.activeCategory) {
      return "Todas las publicaciones asociadas a esta categoria editorial dentro del archivo publico.";
    }

    if (this.activeTag) {
      return "Todas las publicaciones marcadas con esta etiqueta dentro del archivo publico.";
    }

    if (this.activeSearchTerm) {
      return "Resultados del archivo publico por coincidencia en titulo, cuerpo, extracto y etiquetas.";
    }

    if (this.activeSort === "popular") {
      return "Archivo completo de Colombiano Promedio ordenado por nivel de lectura e interaccion reciente.";
    }

    if (this.activeSort === "oldest") {
      return "Archivo completo de Colombiano Promedio comenzando por las publicaciones mas antiguas.";
    }

    return "Archivo completo de Colombiano Promedio con navegacion por paginas y acceso a todas las publicaciones.";
  }

  get emptyStateMessage(): string {
    return this.hasActiveFilters ? "No hay articulos publicados para este filtro." : "Todavia no hay articulos publicados en el archivo.";
  }

  humanize(value: string): string {
    return String(value ?? "")
      .split(/[-\s]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  sortLabel(value: PublicArticleSort): string {
    return this.sortOptions.find((option) => option.value === value)?.label ?? "Mas recientes";
  }

  toggleAdvancedFilters(): void {
    this.advancedFiltersVisible = !this.advancedFiltersVisible;

    if (this.advancedFiltersVisible) {
      void this.loadArchiveFilterOptions();
    }
  }

  async runSearch(): Promise<void> {
    await this.navigateWithFilters();
  }

  async applyAdvancedFilters(): Promise<void> {
    await this.navigateWithFilters();
  }

  async clearFilters(): Promise<void> {
    this.searchTerm = "";
    this.selectedTag = "";
    this.selectedCategory = "";
    this.selectedSort = "latest";

    await this.router.navigate(["/archivo"], {
      queryParams: {
        search: null,
        tag: null,
        category: null,
        sort: null,
        page: null
      }
    });
  }

  async useSuggestedTag(tag: string): Promise<void> {
    this.selectedTag = tag;
    await this.applyAdvancedFilters();
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

  private async navigateWithFilters(): Promise<void> {
    await this.router.navigate(["/archivo"], {
      queryParams: {
        search: this.searchTerm.trim() || null,
        tag: this.selectedTag.trim() || null,
        category: this.selectedCategory || null,
        sort: this.selectedSort !== "latest" ? this.selectedSort : null,
        page: null
      }
    });
  }

  private normalizeSort(value: string | null): PublicArticleSort {
    if (value === "popular" || value === "oldest") {
      return value;
    }

    return "latest";
  }

  private async loadArchiveFilterOptions(): Promise<void> {
    if (this.loadingFilters || this.archiveFiltersLoaded || !this.archiveFiltersSupported) {
      return;
    }

    this.loadingFilters = true;
    this.filtersErrorMessage = "";
    this.cdr.markForCheck();

    try {
      const response = await this.publicApi.getArchiveFilters();

      this.availableCategories = response.categories;
      this.availableTags = response.tags;
      this.archiveFiltersLoaded = true;
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;

      if (status === 404) {
        this.archiveFiltersSupported = false;
        this.archiveFiltersLoaded = true;
        return;
      }

      this.filtersErrorMessage = "No fue posible cargar las sugerencias avanzadas del archivo.";
    } finally {
      this.loadingFilters = false;
      this.cdr.markForCheck();
    }
  }

  private async loadArchive(): Promise<void> {
    const requestId = ++this.requestId;
    const search = this.route.snapshot.queryParamMap.get("search")?.trim() ?? "";
    const tag = this.route.snapshot.queryParamMap.get("tag")?.trim() ?? "";
    const category = this.route.snapshot.queryParamMap.get("category")?.trim() ?? "";
    const sort = this.normalizeSort(this.route.snapshot.queryParamMap.get("sort"));
    const page = Math.max(Number(this.route.snapshot.queryParamMap.get("page") ?? "1"), 1);

    this.loading = true;
    this.errorMessage = "";
    this.searchTerm = search;
    this.activeSearchTerm = search;
    this.selectedTag = tag;
    this.selectedCategory = category;
    this.selectedSort = sort;
    this.activeTag = tag;
    this.activeCategory = category;
    this.activeSort = sort;
    this.cdr.markForCheck();

    try {
      const response = await this.publicApi.searchArticles({
        search,
        tag,
        category,
        sort,
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
      this.errorMessage = "No fue posible cargar el archivo publico.";

      if (this.hasActiveFilters) {
        this.seo.setNoIndex("Archivo no disponible | Colombiano Promedio", this.errorMessage);
      } else {
        this.seo.setArchive({
          page,
          description: this.archiveDescription
        });
      }
    } finally {
      if (requestId === this.requestId) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private updateSeo(): void {
    if (this.hasActiveFilters) {
      this.seo.setNoIndex(`${this.archiveTitle} | Archivo | Colombiano Promedio`, this.archiveDescription);
      return;
    }

    this.seo.setArchive({
      page: this.pagination.page,
      description: this.archiveDescription
    });
  }
}
