import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  PaginatedArticles,
  PublicArticleDetailPayload,
  PublicAuthorProfilePayload,
  PublicArticleFilters,
  SitePayload,
  SubscriptionActionPayload
} from "../types/api.types";
import { API_BASE_URL } from "./api-base";

@Injectable({ providedIn: "root" })
export class PublicApiService {
  private readonly http = inject(HttpClient);

  getSite(): Promise<SitePayload> {
    return firstValueFrom(this.http.get<SitePayload>(`${API_BASE_URL}/public/site`));
  }

  getArticle(slug: string): Promise<PublicArticleDetailPayload> {
    return firstValueFrom(this.http.get<PublicArticleDetailPayload>(`${API_BASE_URL}/public/articles/${slug}`));
  }

  getAuthorProfile(authorId: string, page = 1, limit = 12): Promise<PublicAuthorProfilePayload> {
    const params = new HttpParams()
      .set("page", page)
      .set("limit", limit);

    return firstValueFrom(
      this.http.get<PublicAuthorProfilePayload>(`${API_BASE_URL}/public/authors/${authorId}`, {
        params
      })
    );
  }

  searchArticles(filters: PublicArticleFilters = {}): Promise<PaginatedArticles> {
    let params = new HttpParams().set("page", filters.page ?? 1);

    if (filters.search?.trim()) {
      params = params.set("search", filters.search.trim());
    }

    if (filters.tag?.trim()) {
      params = params.set("tag", filters.tag.trim());
    }

    if (filters.category?.trim()) {
      params = params.set("category", filters.category.trim());
    }

    return firstValueFrom(
      this.http.get<PaginatedArticles>(`${API_BASE_URL}/public/articles`, {
        params
      })
    );
  }

  subscribe(payload: { name: string; email: string; plan: "newsletter" | "premium"; interests: string[] }) {
    return firstValueFrom(this.http.post<SubscriptionActionPayload>(`${API_BASE_URL}/public/subscriptions`, payload));
  }

  confirmSubscription(token: string): Promise<SubscriptionActionPayload> {
    return firstValueFrom(
      this.http.post<SubscriptionActionPayload>(`${API_BASE_URL}/public/subscriptions/confirm`, {
        token
      })
    );
  }

  reactivateSubscription(token: string): Promise<SubscriptionActionPayload> {
    return firstValueFrom(
      this.http.post<SubscriptionActionPayload>(`${API_BASE_URL}/public/subscriptions/reactivate`, {
        token
      })
    );
  }

  unsubscribeSubscription(token: string): Promise<SubscriptionActionPayload> {
    return firstValueFrom(
      this.http.post<SubscriptionActionPayload>(`${API_BASE_URL}/public/subscriptions/unsubscribe`, {
        token
      })
    );
  }
}
