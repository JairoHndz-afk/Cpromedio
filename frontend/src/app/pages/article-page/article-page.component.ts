import { DatePipe, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { PublicApiService } from "../../core/services/public-api.service";
import { SeoService } from "../../core/services/seo.service";
import { ArticleContentBlock, PublicArticle, PublicArticlePreview } from "../../core/types/api.types";
import { ArticleGalleryImage, ArticleRenderSegment, buildArticleRenderSegments } from "../../core/utils/article-render-segments";
import { renderEditorialText } from "../../core/utils/editorial-rich-text";
import { isInstagramEmbed, isTweetEmbed, resolveInstagramEmbedSource, resolveTweetEmbedSource, resolveVideoEmbed } from "../../core/utils/video-embed";

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
        <ng-container *ngFor="let segment of articleRenderSegments; trackBy: trackRenderSegment">
          <ng-container *ngIf="segment.kind === 'block' && segment.block.type === 'heading'">
            <h2
              *ngIf="segment.block.heading.level === 'h2'; else compactHeading"
              class="article-section-heading"
              [class.article-section-heading--center]="segment.block.heading.align === 'center'"
              [class.article-section-heading--right]="segment.block.heading.align === 'right'"
              [innerHTML]="renderBlockText(segment.block)"
            ></h2>
            <ng-template #compactHeading>
              <h3
                class="article-section-heading article-section-heading--compact"
                [class.article-section-heading--center]="segment.block.heading.align === 'center'"
                [class.article-section-heading--right]="segment.block.heading.align === 'right'"
                [innerHTML]="renderBlockText(segment.block)"
              ></h3>
            </ng-template>
          </ng-container>

          <p *ngIf="segment.kind === 'block' && segment.block.type === 'paragraph'" [innerHTML]="renderBlockText(segment.block)"></p>

          <blockquote class="article-quote" *ngIf="segment.kind === 'block' && segment.block.type === 'quote'">
            <p [innerHTML]="renderBlockText(segment.block)"></p>
            <footer class="article-quote__attribution" *ngIf="segment.block.quote.attribution">{{ segment.block.quote.attribution }}</footer>
          </blockquote>

          <figure class="article-inline-media" *ngIf="segment.kind === 'block' && segment.block.type === 'image' && segment.block.image.url">
            <img [src]="segment.block.image.url" [alt]="segment.block.image.alt || article.title" />
            <figcaption *ngIf="segment.block.image.caption || segment.block.image.alt">{{ segment.block.image.caption || segment.block.image.alt }}</figcaption>
          </figure>

          <figure class="article-image-gallery" *ngIf="segment.kind === 'gallery' && articleGalleryImage(segment) as activeArticleImage">
            <div class="article-image-gallery__frame">
              <button
                class="article-image-gallery__control article-image-gallery__control--prev"
                type="button"
                (click)="previousArticleGallerySlide(segment)"
                [disabled]="segment.images.length < 2"
                aria-label="Ver foto anterior"
              >
                &#8249;
              </button>
              <img [src]="activeArticleImage.url" [alt]="activeArticleImage.alt || article.title" />
              <button
                class="article-image-gallery__control article-image-gallery__control--next"
                type="button"
                (click)="nextArticleGallerySlide(segment)"
                [disabled]="segment.images.length < 2"
                aria-label="Ver foto siguiente"
              >
                &#8250;
              </button>
              <span class="article-image-gallery__count">{{ articleGallerySlideLabel(segment) }}</span>
            </div>
            <figcaption class="article-image-gallery__footer">
              <span class="article-image-gallery__caption">{{ activeArticleImage.caption || activeArticleImage.alt || "Serie fotográfica del artículo" }}</span>
              <span class="article-image-gallery__dots" *ngIf="segment.images.length > 1">
                <button
                  type="button"
                  class="article-image-gallery__dot"
                  *ngFor="let image of segment.images; let imageIndex = index"
                  [class.is-active]="imageIndex === activeArticleGalleryIndex(segment)"
                  (click)="setArticleGallerySlide(segment, imageIndex)"
                  [attr.aria-label]="'Ver foto ' + (imageIndex + 1)"
                ></button>
              </span>
            </figcaption>
          </figure>

          <ng-container *ngIf="segment.kind === 'block' && segment.block.type === 'embed'">
            <figure class="article-inline-embed article-inline-embed--tweet" *ngIf="isTweetEmbedUrl(segment.block.embed.url) && tweetEmbedSource(segment.block.embed.url) as tweetUrl; else articleVideoEmbed">
              <blockquote class="twitter-tweet" [attr.data-theme]="tweetTheme()" data-dnt="true">
                <a [href]="tweetUrl" target="_blank" rel="noopener noreferrer">Ver publicacion en X / Twitter</a>
              </blockquote>
              <figcaption *ngIf="segment.block.embed.title">{{ segment.block.embed.title }}</figcaption>
            </figure>
            <ng-template #articleVideoEmbed>
              <figure class="article-inline-embed article-inline-embed--instagram" *ngIf="isInstagramEmbedUrl(segment.block.embed.url) && instagramEmbedSource(segment.block.embed.url) as instagramUrl; else articleMediaEmbed">
                <blockquote class="instagram-media" data-instgrm-captioned [attr.data-instgrm-permalink]="instagramUrl" data-instgrm-version="14">
                  <a [href]="instagramUrl" target="_blank" rel="noopener noreferrer">Ver publicacion en Instagram</a>
                </blockquote>
                <figcaption *ngIf="segment.block.embed.title">{{ segment.block.embed.title }}</figcaption>
              </figure>
              <ng-template #articleMediaEmbed>
                <figure class="article-inline-embed" *ngIf="safeArticleEmbedUrl(segment.block.embed.url) as embedUrl">
                  <iframe
                    [src]="embedUrl"
                    [title]="segment.block.embed.title || article.title"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                  ></iframe>
                  <figcaption *ngIf="segment.block.embed.title">{{ segment.block.embed.title }}</figcaption>
                </figure>
              </ng-template>
            </ng-template>
          </ng-container>
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
  articleRenderSegments: ArticleRenderSegment[] = [];
  nextArticle: PublicArticlePreview | null = null;
  errorMessage = "";
  shareMessage = "";
  relatedTopicLabel: string | null = null;
  nextActionLabel = "Leer siguiente";
  nextSectionLabel = "Quizás te puede interesar";
  private readonly articleGalleryIndexes: Record<string, number> = {};

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

  trackRenderSegment(_index: number, segment: ArticleRenderSegment): string {
    return segment.key;
  }

  activeArticleGalleryIndex(segment: ArticleRenderSegment): number {
    if (segment.kind !== "gallery") {
      return 0;
    }

    return this.resolveGalleryIndex(segment.key, segment.images.length);
  }

  articleGalleryImage(segment: ArticleRenderSegment): ArticleGalleryImage | null {
    if (segment.kind !== "gallery" || segment.images.length === 0) {
      return null;
    }

    return segment.images[this.activeArticleGalleryIndex(segment)] ?? segment.images[0];
  }

  articleGallerySlideLabel(segment: ArticleRenderSegment): string {
    if (segment.kind !== "gallery") {
      return "";
    }

    return `${this.activeArticleGalleryIndex(segment) + 1} / ${segment.images.length}`;
  }

  setArticleGallerySlide(segment: ArticleRenderSegment, index: number): void {
    if (segment.kind !== "gallery") {
      return;
    }

    this.articleGalleryIndexes[segment.key] = Math.min(Math.max(index, 0), segment.images.length - 1);
    this.cdr.markForCheck();
  }

  previousArticleGallerySlide(segment: ArticleRenderSegment): void {
    if (segment.kind !== "gallery") {
      return;
    }

    const currentIndex = this.activeArticleGalleryIndex(segment);
    const nextIndex = currentIndex === 0 ? segment.images.length - 1 : currentIndex - 1;
    this.setArticleGallerySlide(segment, nextIndex);
  }

  nextArticleGallerySlide(segment: ArticleRenderSegment): void {
    if (segment.kind !== "gallery") {
      return;
    }

    const currentIndex = this.activeArticleGalleryIndex(segment);
    const nextIndex = currentIndex === segment.images.length - 1 ? 0 : currentIndex + 1;
    this.setArticleGallerySlide(segment, nextIndex);
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

  tweetTheme(): "dark" | "light" {
    return document.documentElement.dataset["theme"] === "dark" ? "dark" : "light";
  }

  shareTo(channel: ShareChannel): void {
    if (!this.article) {
      return;
    }

    const articleUrl = `${window.location.origin}/articulo/${this.article.slug}`;
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
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${articleUrl}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(shareText)}`,
      x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`
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
      authorName: article.author?.name || "Colombiano Promedio",
      authorId: article.author?.id,
      categoryName: article.category?.name || undefined,
      tags: article.tags,
      isPremium: article.isPremium
    });
  }

  async loadArticle(currentSlug: string): Promise<void> {
    let shouldRenderSocialEmbeds = false;

    this.article = null;
    this.articleRenderSegments = [];
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
      this.articleRenderSegments = buildArticleRenderSegments(response.article.contentBlocks);
      this.nextArticle = response.nextArticle;
      shouldRenderSocialEmbeds = this.articleHasSocialEmbeds(response.article);
      this.syncTopicState();
      this.applySeo(response.article);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;

      if (status !== 404) {
        this.errorMessage = "No fue posible cargar el artÃ­culo.";
        this.seo.setArticleFallback({
          slug: currentSlug
        });
        return;
      }
      this.errorMessage = "No fue posible cargar el artículo.";
      this.seo.setNoIndex("Artículo no disponible | Colombiano Promedio", this.errorMessage);
    } finally {
      this.cdr.markForCheck();

      if (shouldRenderSocialEmbeds) {
        setTimeout(() => this.renderSocialEmbeds(), 0);
      }
    }
  }

  private articleHasSocialEmbeds(article: PublicArticle | null): boolean {
    return article?.contentBlocks.some((block) => block.type === "embed" && (isTweetEmbed(block.embed.url) || isInstagramEmbed(block.embed.url))) ?? false;
  }

  private renderSocialEmbeds(): void {
    const articleBody = document.querySelector(".article-body");

    if (!(articleBody instanceof HTMLElement)) {
      return;
    }

    this.renderTweetEmbeds(articleBody);
    this.renderInstagramEmbeds();
  }

  private renderTweetEmbeds(articleBody: HTMLElement): void {
    if (!this.articleHasTweetEmbeds(this.article)) {
      return;
    }

    const twitterWindow = window as Window & {
      twttr?: {
        widgets?: {
          load?: (element?: HTMLElement) => void;
        };
      };
    };

    if (twitterWindow.twttr?.widgets?.load) {
      twitterWindow.twttr.widgets.load(articleBody);
      return;
    }

    const existingScript = document.querySelector('script[data-twitter-widgets="true"]') as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => twitterWindow.twttr?.widgets?.load?.(articleBody), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.setAttribute("data-twitter-widgets", "true");
    script.addEventListener("load", () => twitterWindow.twttr?.widgets?.load?.(articleBody), { once: true });
    document.body.appendChild(script);
  }

  private articleHasTweetEmbeds(article: PublicArticle | null): boolean {
    return article?.contentBlocks.some((block) => block.type === "embed" && isTweetEmbed(block.embed.url)) ?? false;
  }

  private resolveGalleryIndex(key: string, total: number): number {
    if (total <= 0) {
      return 0;
    }

    const current = this.articleGalleryIndexes[key] ?? 0;
    return Math.min(Math.max(current, 0), total - 1);
  }

  private articleHasInstagramEmbeds(article: PublicArticle | null): boolean {
    return article?.contentBlocks.some((block) => block.type === "embed" && isInstagramEmbed(block.embed.url)) ?? false;
  }

  private renderInstagramEmbeds(): void {
    if (!this.articleHasInstagramEmbeds(this.article)) {
      return;
    }

    const instagramWindow = window as Window & {
      instgrm?: {
        Embeds?: {
          process?: () => void;
        };
      };
    };

    if (instagramWindow.instgrm?.Embeds?.process) {
      instagramWindow.instgrm.Embeds.process();
      return;
    }

    const existingScript = document.querySelector('script[data-instagram-embeds="true"]') as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => instagramWindow.instgrm?.Embeds?.process?.(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.setAttribute("data-instagram-embeds", "true");
    script.addEventListener("load", () => instagramWindow.instgrm?.Embeds?.process?.(), { once: true });
    document.body.appendChild(script);
  }
}
