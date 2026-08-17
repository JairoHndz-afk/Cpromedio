import { DatePipe, NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { combineLatest } from "rxjs";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";
import { PaginationMeta, PublicAuthorProfile, PublicArticlePreview } from "../../core/types/api.types";
import { NewsCardComponent } from "../../shared/components/news-card/news-card.component";

@Component({
  selector: "app-author-page",
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, RouterLink, NewsCardComponent],
  template: `
    <section class="section-block author-shell" *ngIf="author; else loadingState">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Archivo del autor</p>
          <h1>{{ author.name }}</h1>
          <p class="hero-copy">{{ authorDescription }}</p>
        </div>
        <div class="meta-row">
          <span class="meta-pill meta-pill--author">{{ formatRole(author.role) }}</span>
          <span class="meta-pill">{{ author.articleCount }} artículos</span>
          <span class="meta-pill meta-pill--soft" *ngIf="author.latestPublishedAt">
            Última publicación {{ author.latestPublishedAt | date: "d MMM y, h:mm a" }}
          </span>
        </div>
      </div>

      <div class="button-row">
        <a class="button button--ghost" routerLink="/">Volver a portada</a>
      </div>

      <div class="cards-grid">
        <app-news-card *ngFor="let article of articles" [article]="article"></app-news-card>
      </div>

      <p class="empty-state" *ngIf="articles.length === 0">Este autor todavía no tiene artículos publicados.</p>

      <div class="section-heading" *ngIf="pagination.total > 0">
        <div>
          <p class="helper-text">Página {{ pagination.page }} de {{ pagination.totalPages }} | {{ pagination.total }} publicaciones</p>
        </div>
        <div class="button-row" *ngIf="pagination.totalPages > 1">
          <button class="button button--ghost" type="button" (click)="changePage(pagination.page - 1)" [disabled]="pagination.page <= 1">
            Anterior
          </button>
          <button
            class="button button--ghost"
            type="button"
            (click)="changePage(pagination.page + 1)"
            [disabled]="pagination.page >= pagination.totalPages"
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>

    <ng-template #loadingState>
      <section class="empty-state">{{ errorMessage || "Cargando archivo del autor..." }}</section>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthorPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  author: PublicAuthorProfile | null = null;
  articles: PublicArticlePreview[] = [];
  errorMessage = "";
  pagination: PaginationMeta = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  };

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed()).subscribe(() => {
      void this.loadAuthor();
    });
  }

  get authorDescription(): string {
    if (!this.author) {
      return "";
    }

    const base = `${this.author.name} reúne ${this.author.articleCount} publicación${this.author.articleCount === 1 ? "" : "es"} activas en Colombiano Promedio.`;
    return this.author.latestPublishedAt
      ? `${base} La más reciente fue actualizada el ${new Date(this.author.latestPublishedAt).toLocaleString("es-CO")}.`
      : base;
  }

  formatRole(value: string): string {
    return value === "admin" ? "Editor" : "Periodista";
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

  async loadAuthor(): Promise<void> {
    const authorId = this.route.snapshot.paramMap.get("authorId") ?? "";
    const page = Math.max(Number(this.route.snapshot.queryParamMap.get("page") ?? "1"), 1);

    if (!authorId) {
      this.author = null;
      this.articles = [];
      this.errorMessage = "No fue posible identificar al autor.";
      this.seo.setNoIndex("Autor no disponible | Colombiano Promedio", this.errorMessage);
      this.cdr.markForCheck();
      return;
    }

    this.errorMessage = "";
    this.cdr.markForCheck();

    try {
      const response = await this.publicApi.getAuthorProfile(authorId, page, this.pagination.limit);
      this.author = response.author;
      this.articles = response.items;
      this.pagination = response.pagination;
      this.seo.setAuthor({
        name: response.author.name,
        description: this.authorDescription,
        authorId: response.author.id
      });
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;

      this.author = null;
      this.articles = [];

      if (status === 404) {
        this.errorMessage = "Autor no disponible.";
        this.seo.setNoIndex("Autor no disponible | Colombiano Promedio", this.errorMessage);
      } else {
        this.errorMessage = "No fue posible cargar el archivo del autor.";
        this.seo.setAuthorFallback({
          authorId,
          description: "Archivo publico de autores y publicaciones de Colombiano Promedio."
        });
      }
    } finally {
      this.cdr.markForCheck();
    }
  }
}
