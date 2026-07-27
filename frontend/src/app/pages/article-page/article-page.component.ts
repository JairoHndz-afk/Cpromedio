import { DatePipe, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";
import { ArticleContentBlock, PublicArticle, PublicArticlePreview } from "../../core/types/api.types";
import { renderEditorialText } from "../../core/utils/editorial-rich-text";
import { resolveVideoEmbed } from "../../core/utils/video-embed";

type ShareChannel = "whatsapp" | "telegram" | "x" | "facebook" | "copy";

@Component({
  selector: "app-article-page",
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, DatePipe, NgSwitch, NgSwitchCase, NgSwitchDefault],
  template: `
    <section class="article-shell" *ngIf="article; else loadingState">
      <div class="article-header">
        <div class="article-actions">
          <a routerLink="/" class="button button--ghost article-back-button">Volver al inicio</a>
          <a *ngIf="nextArticle" class="button button--secondary" [routerLink]="['/articulo', nextArticle.slug]">{{ nextActionLabel }}</a>
        </div>
        <p class="eyebrow">Lectura editorial</p>
        <h1>{{ article.title }}</h1>
        <p class="hero-copy">{{ article.subtitle || article.excerpt }}</p>
        <div class="meta-row meta-row--featured">
          <a class="meta-pill meta-pill--author" *ngIf="article.author?.id; else plainAuthorPill" [routerLink]="['/autor', article.author?.id]">
            {{ article.author?.name || "Redacción" }}
          </a>
          <ng-template #plainAuthorPill>
            <span class="meta-pill meta-pill--author">{{ article.author?.name || "Redacción" }}</span>
          </ng-template>
          <span class="meta-pill" *ngIf="article.publishedAt">{{ article.publishedAt | date: "d MMM y, h:mm a" }}</span>
          <span class="meta-pill meta-pill--warm">{{ article.readingTime }} min de lectura</span>
          <span class="meta-pill meta-pill--soft">{{ article.metrics.views }} vistas</span>
        </div>
      </div>

      <ng-container *ngIf="article.cover.url; else textCover">
        <div class="article-cover article-cover--visual" *ngIf="hasVisualCover(article); else nonVisualCover">
          <img
            [src]="article.cover.url"
            [alt]="article.cover.alt || article.title"
            [style.object-position]="coverObjectPosition(article.cover)"
          />
        </div>

        <ng-template #nonVisualCover>
          <div class="article-cover" [ngSwitch]="article.cover.type">
            <video *ngSwitchCase="'video'" [src]="article.cover.url" [attr.aria-label]="article.cover.alt || article.title" controls></video>
            <div class="article-cover article-cover--audio" *ngSwitchCase="'audio'">
              <audio controls [src]="article.cover.url"></audio>
            </div>
            <img
              *ngSwitchDefault
              [src]="article.cover.url"
              [alt]="article.cover.alt || article.title"
              [style.object-position]="coverObjectPosition(article.cover)"
            />
          </div>
        </ng-template>
      </ng-container>

      <ng-template #textCover>
        <div class="article-cover article-cover--placeholder">
          <span>{{ article.author?.name || "Redacción" }}</span>
        </div>
      </ng-template>

      <article class="article-body">
        <ng-container *ngFor="let block of article.contentBlocks">
          <ng-container *ngIf="block.type === 'heading'">
            <h2
              *ngIf="block.heading.level === 'h2'; else compactHeading"
              class="article-section-heading"
              [class.article-section-heading--center]="block.heading.align === 'center'"
              [class.article-section-heading--right]="block.heading.align === 'right'"
              [innerHTML]="renderBlockText(block)"
            ></h2>
            <ng-template #compactHeading>
              <h3
                class="article-section-heading article-section-heading--compact"
                [class.article-section-heading--center]="block.heading.align === 'center'"
                [class.article-section-heading--right]="block.heading.align === 'right'"
                [innerHTML]="renderBlockText(block)"
              ></h3>
            </ng-template>
          </ng-container>

          <p *ngIf="block.type === 'paragraph'" [innerHTML]="renderBlockText(block)"></p>

          <blockquote class="article-quote" *ngIf="block.type === 'quote'">
            <p [innerHTML]="renderBlockText(block)"></p>
            <footer class="article-quote__attribution" *ngIf="block.quote.attribution">{{ block.quote.attribution }}</footer>
          </blockquote>

          <figure class="article-inline-media" *ngIf="block.type === 'image' && block.image.url">
            <img [src]="block.image.url" [alt]="block.image.alt || article.title" />
            <figcaption *ngIf="block.image.caption || block.image.alt">{{ block.image.caption || block.image.alt }}</figcaption>
          </figure>

          <figure class="article-inline-embed" *ngIf="block.type === 'embed' && safeArticleEmbedUrl(block.embed.url) as embedUrl">
            <iframe
              [src]="embedUrl"
              [title]="block.embed.title || article.title"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
            <figcaption *ngIf="block.embed.title">{{ block.embed.title }}</figcaption>
          </figure>
        </ng-container>
      </article>

      <section class="article-meta">
        <div>
          <p class="eyebrow">Firma</p>
          <a class="article-signature article-signature__link" *ngIf="article.author?.id; else authorNameOnly" [routerLink]="['/autor', article.author?.id]">
            {{ article.author?.name || "Redacción" }}
          </a>
          <ng-template #authorNameOnly>
            <strong class="article-signature">{{ article.author?.name || "Redacción" }}</strong>
          </ng-template>
          <p>{{ article.author?.role || "Equipo editorial" }}</p>
        </div>
        <div>
          <p class="eyebrow">Publicación</p>
          <strong>{{ article.publishedAt ? (article.publishedAt | date: "d MMM y, h:mm a") : "Edición sin fecha visible" }}</strong>
          <p>Actualizado {{ article.updatedAt | date: "d MMM y, h:mm a" }}</p>
        </div>
      </section>

      <section class="article-share">
        <div>
          <p class="eyebrow">Compartir</p>
          <h2>Comparte esta lectura</h2>
        </div>
        <div class="share-buttons">
          <button class="button button--ghost button--share" type="button" (click)="shareTo('whatsapp')">WhatsApp</button>
          <button class="button button--ghost button--share" type="button" (click)="shareTo('telegram')">Telegram</button>
          <button class="button button--ghost button--share" type="button" (click)="shareTo('x')">X</button>
          <button class="button button--ghost button--share" type="button" (click)="shareTo('facebook')">Facebook</button>
          <button class="button button--secondary button--share" type="button" (click)="shareTo('copy')">Copiar enlace</button>
        </div>
        <p class="helper-text" *ngIf="shareMessage">{{ shareMessage }}</p>
      </section>

      <section class="article-next" *ngIf="nextArticle as next">
        <p class="eyebrow">{{ nextSectionLabel }}</p>
        <a class="article-next__card" [routerLink]="['/articulo', next.slug]">
          <div class="article-next__copy">
            <strong>{{ next.title }}</strong>
            <p>{{ next.excerpt }}</p>
            <div class="meta-row">
              <span class="meta-pill meta-pill--author">{{ next.author?.name || "Redacción" }}</span>
              <span class="meta-pill meta-pill--warm">{{ next.readingTime }} min</span>
              <span class="meta-pill meta-pill--soft">{{ next.metrics.views }} vistas</span>
            </div>
          </div>

          <ng-container *ngIf="hasVisualCover(next); else nextPlaceholder">
            <div class="article-next__media">
              <img [src]="next.cover.url" [alt]="next.cover.alt || next.title" [style.object-position]="coverObjectPosition(next.cover)" />
            </div>
          </ng-container>

          <ng-template #nextPlaceholder>
            <div class="article-next__media article-next__media--placeholder">
              <span>{{ next.category?.name || "Siguiente artículo" }}</span>
            </div>
          </ng-template>
        </a>
      </section>
    </section>
    <ng-template #loadingState>
      <section class="empty-state">{{ errorMessage || "Cargando artículo..." }}</section>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticlePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicApi = inject(PublicApiService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);

  article: PublicArticle | null = null;
  nextArticle: PublicArticlePreview | null = null;
  errorMessage = "";
  shareMessage = "";
  relatedTopicLabel: string | null = null;
  nextActionLabel = "Leer siguiente";
  nextSectionLabel = "Quizás te puede interesar";

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      void this.loadArticle(params.get("slug") ?? "");
    });
  }

  renderBlockText(block: ArticleContentBlock): string {
    if (block.type === "heading") {
      return renderEditorialText(block.heading.text);
    }

    if (block.type === "paragraph") {
      return renderEditorialText(block.text);
    }

    if (block.type === "quote") {
      return renderEditorialText(block.quote.text);
    }

    return "";
  }

  formatTopicLabel(value: string): string {
    return value
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  hasVisualCover(article: Pick<PublicArticle, "cover"> | PublicArticlePreview): boolean {
    return article.cover.type === "image" || article.cover.type === "infographic";
  }

  coverObjectPosition(cover: PublicArticle["cover"] | PublicArticlePreview["cover"]): string {
    return `${cover.positionX ?? 50}% ${cover.positionY ?? 50}%`;
  }

  safeArticleEmbedUrl(value: string): SafeResourceUrl | null {
    const resolved = resolveVideoEmbed(value);
    return resolved ? this.sanitizer.bypassSecurityTrustResourceUrl(resolved.embedUrl) : null;
  }

  shareTo(channel: ShareChannel): void {
    if (!this.article) {
      return;
    }

    const articleUrl = `${window.location.origin}/articulo/${this.article.slug}`;
    const shareUrl = `${window.location.origin}/compartir/${this.article.slug}`;
    const shareText = `${this.article.title} | Colombiano Promedio`;

    if (channel === "copy") {
      void navigator.clipboard
        .writeText(articleUrl)
        .then(() => {
          this.shareMessage = "Enlace del articulo copiado.";
          this.cdr.markForCheck();
        })
        .catch(() => {
          this.shareMessage = "No fue posible copiar el enlace.";
          this.cdr.markForCheck();
        });
      return;
    }

    const destinations: Record<Exclude<ShareChannel, "copy">, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    };

    this.shareMessage = "";
    window.open(destinations[channel], "_blank", "noopener,noreferrer");
  }

  private syncTopicState(): void {
    const currentArticle = this.article;

    if (!currentArticle) {
      this.relatedTopicLabel = null;
      this.nextActionLabel = "Leer siguiente";
      this.nextSectionLabel = "Quizás te puede interesar";
      return;
    }

    if (currentArticle.category) {
      this.relatedTopicLabel = currentArticle.category.name;
    } else if (currentArticle.tags.length > 0) {
      this.relatedTopicLabel = this.formatTopicLabel(currentArticle.tags[0]);
    } else {
      this.relatedTopicLabel = null;
    }

    this.nextActionLabel = this.relatedTopicLabel ? `Leer siguiente de ${this.relatedTopicLabel}` : "Leer siguiente";
    this.nextSectionLabel = "Quizás te puede interesar";
  }

  private applySeo(article: PublicArticle): void {
    this.seo.setArticle({
      title: article.title,
      description: article.subtitle || article.excerpt,
      slug: article.slug,
      imageUrl: article.cover.url,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      authorName: article.author?.name || "Colombiano Promedio"
    });
  }

  async loadArticle(currentSlug: string): Promise<void> {
    this.article = null;
    this.nextArticle = null;
    this.errorMessage = "";
    this.shareMessage = "";
    this.relatedTopicLabel = null;
    this.nextActionLabel = "Leer siguiente";
    this.nextSectionLabel = "Quizás te puede interesar";
    this.cdr.markForCheck();

    try {
      const response = await this.publicApi.getArticle(currentSlug);
      this.article = response.article;
      this.nextArticle = response.nextArticle;
      this.syncTopicState();
      this.applySeo(response.article);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      this.errorMessage = "No fue posible cargar el artículo.";
      this.seo.setNoIndex("Artículo no disponible | Colombiano Promedio", this.errorMessage);
    } finally {
      this.cdr.markForCheck();
    }
  }
}
