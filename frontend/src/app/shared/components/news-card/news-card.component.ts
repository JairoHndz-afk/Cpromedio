import { DatePipe, NgClass, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";

import { PublicArticle } from "../../../core/types/api.types";

@Component({
  selector: "app-news-card",
  standalone: true,
  imports: [RouterLink, NgClass, NgIf, DatePipe, NgSwitch, NgSwitchCase, NgSwitchDefault],
  template: `
    <article class="news-card" [ngClass]="{ 'news-card--compact': variant === 'compact' }">
      <a
        class="news-card__media"
        [routerLink]="['/articulo', article.slug]"
        [attr.aria-label]="'Abrir ' + article.title"
        [ngSwitch]="article.cover.type"
        *ngIf="article.cover.url; else placeholder"
      >
        <img
          *ngSwitchCase="'image'"
          [src]="article.cover.url"
          [alt]="article.cover.alt || article.title"
          [style.object-position]="coverObjectPosition()"
        />
        <img
          *ngSwitchCase="'infographic'"
          [src]="article.cover.url"
          [alt]="article.cover.alt || article.title"
          [style.object-position]="coverObjectPosition()"
        />
        <video *ngSwitchCase="'video'" [src]="article.cover.url" muted playsinline preload="metadata"></video>
        <div class="news-card__media news-card__media--audio" *ngSwitchCase="'audio'">
          <span>Audio editorial</span>
        </div>
        <img
          *ngSwitchDefault
          [src]="article.cover.url"
          [alt]="article.cover.alt || article.title"
          [style.object-position]="coverObjectPosition()"
        />
      </a>

      <ng-template #placeholder>
        <a
          class="news-card__media news-card__media--placeholder"
          [routerLink]="['/articulo', article.slug]"
          [attr.aria-label]="'Abrir ' + article.title"
        >
          <span>{{ article.author?.name || "Redaccion" }}</span>
        </a>
      </ng-template>

      <div class="news-card__body">
        <div class="card-kicker-row">
          <a
            class="tag tag--category"
            *ngIf="article.category"
            routerLink="/"
            [queryParams]="{ category: article.category.slug }"
          >
            {{ article.category.name }}
          </a>
          <span class="tag" *ngIf="article.cover.type !== 'image'">{{ article.cover.type }}</span>
        </div>
        <p class="news-card__author">
          <a *ngIf="article.author?.id; else plainAuthor" [routerLink]="['/autor', article.author?.id]">{{ article.author?.name || "Redacción" }}</a>
          <ng-template #plainAuthor>{{ article.author?.name || "Redacción" }}</ng-template>
        </p>
        <h3>
          <a class="news-card__title-link" [routerLink]="['/articulo', article.slug]">{{ article.title }}</a>
        </h3>
        <p>{{ article.excerpt }}</p>
        <div class="tag-row news-card__tags" *ngIf="article.tags.length > 0">
          <a class="tag tag--interactive" *ngFor="let tag of article.tags.slice(0, 2)" routerLink="/" [queryParams]="{ tag: tag }">
            {{ formatTopicLabel(tag) }}
          </a>
        </div>

        <div class="meta-row">
          <span class="meta-pill" *ngIf="article.publishedAt">{{ article.publishedAt | date: "mediumDate" }}</span>
          <span class="meta-pill meta-pill--warm">{{ article.readingTime }} min</span>
          <span class="meta-pill meta-pill--soft">{{ article.metrics.views }} vistas</span>
        </div>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsCardComponent {
  @Input({ required: true }) article!: PublicArticle;
  @Input() variant: "default" | "compact" = "default";

  coverObjectPosition(): string {
    return `${this.article.cover.positionX ?? 50}% ${this.article.cover.positionY ?? 50}%`;
  }

  formatTopicLabel(value: string): string {
    return value
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
