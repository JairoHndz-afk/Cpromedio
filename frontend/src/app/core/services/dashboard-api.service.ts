import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  AlliedFeedSource,
  AlliedFeedSyncResult,
  AuditEntry,
  Category,
  DashboardArticle,
  DashboardArticleComment,
  DashboardArticleCommentsPayload,
  DashboardArticlePage,
  DashboardOverview,
  PaginatedSubscriptions,
  PaginatedUsers,
  SiteCommunication,
  SubscriptionEntry,
  UploadedImagePayload,
  UserSession
} from "../types/api.types";
import { API_BASE_URL } from "./api-base";

@Injectable({ providedIn: "root" })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  getOverview(): Promise<DashboardOverview> {
    return firstValueFrom(this.http.get<DashboardOverview>(`${API_BASE_URL}/dashboard/overview`));
  }

  getCommunication(): Promise<{ communication: SiteCommunication | null }> {
    return firstValueFrom(this.http.get<{ communication: SiteCommunication | null }>(`${API_BASE_URL}/dashboard/communication`));
  }

  getAlliedFeeds(): Promise<{ items: AlliedFeedSource[] }> {
    return firstValueFrom(this.http.get<{ items: AlliedFeedSource[] }>(`${API_BASE_URL}/dashboard/allied-feeds`));
  }

  createAlliedFeed(payload: Record<string, unknown>): Promise<{ source: AlliedFeedSource }> {
    return firstValueFrom(this.http.post<{ source: AlliedFeedSource }>(`${API_BASE_URL}/dashboard/allied-feeds`, payload));
  }

  updateAlliedFeed(sourceId: string, payload: Record<string, unknown>): Promise<{ source: AlliedFeedSource }> {
    return firstValueFrom(this.http.put<{ source: AlliedFeedSource }>(`${API_BASE_URL}/dashboard/allied-feeds/${sourceId}`, payload));
  }

  deleteAlliedFeed(sourceId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.delete<{ message: string }>(`${API_BASE_URL}/dashboard/allied-feeds/${sourceId}`));
  }

  syncAlliedFeed(sourceId: string): Promise<{ message: string; result: AlliedFeedSyncResult }> {
    return firstValueFrom(this.http.post<{ message: string; result: AlliedFeedSyncResult }>(`${API_BASE_URL}/dashboard/allied-feeds/${sourceId}/sync`, {}));
  }

  saveCommunication(payload: {
    eyebrow: string;
    title: string;
    message: string;
    ctaLabel: string;
    ctaUrl: string;
    durationPreset: "hours" | "week" | "month";
    durationHours: number;
  }): Promise<{ communication: SiteCommunication | null }> {
    return firstValueFrom(this.http.put<{ communication: SiteCommunication | null }>(`${API_BASE_URL}/dashboard/communication`, payload));
  }

  deleteCommunication(): Promise<{ message: string }> {
    return firstValueFrom(this.http.delete<{ message: string }>(`${API_BASE_URL}/dashboard/communication`));
  }

  updateProfile(payload: { name: string }): Promise<{ user: UserSession }> {
    return firstValueFrom(this.http.put<{ user: UserSession }>(`${API_BASE_URL}/dashboard/profile`, payload));
  }

  changePassword(payload: { currentPassword: string; nextPassword: string; confirmPassword: string }): Promise<{ message: string }> {
    return firstValueFrom(this.http.put<{ message: string }>(`${API_BASE_URL}/dashboard/profile/password`, payload));
  }

  getArticles(filters: { search?: string; status?: string; page?: number; limit?: number } = {}): Promise<DashboardArticlePage> {
    let params = new HttpParams();
    if (filters.search?.trim()) {
      params = params.set("search", filters.search.trim());
    }
    if (filters.status?.trim()) {
      params = params.set("status", filters.status.trim());
    }
    if (filters.page) {
      params = params.set("page", filters.page);
    }
    if (filters.limit) {
      params = params.set("limit", filters.limit);
    }

    return firstValueFrom(
      this.http.get<DashboardArticlePage>(`${API_BASE_URL}/dashboard/articles`, {
        params
      })
    );
  }

  getArticle(articleId: string): Promise<DashboardArticle> {
    return firstValueFrom(this.http.get<DashboardArticle>(`${API_BASE_URL}/dashboard/articles/${articleId}`));
  }

  createArticle(payload: Record<string, unknown>): Promise<DashboardArticle> {
    return firstValueFrom(this.http.post<DashboardArticle>(`${API_BASE_URL}/dashboard/articles`, payload));
  }

  updateArticle(articleId: string, payload: Record<string, unknown>): Promise<DashboardArticle> {
    return firstValueFrom(this.http.put<DashboardArticle>(`${API_BASE_URL}/dashboard/articles/${articleId}`, payload));
  }

  deleteArticle(articleId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.delete<{ message: string }>(`${API_BASE_URL}/dashboard/articles/${articleId}`));
  }

  submitArticle(articleId: string) {
    return firstValueFrom(this.http.post(`${API_BASE_URL}/dashboard/articles/${articleId}/submit`, {}));
  }

  moderateArticle(articleId: string, action: string, note: string): Promise<DashboardArticle> {
    return firstValueFrom(
      this.http.post<DashboardArticle>(`${API_BASE_URL}/dashboard/articles/${articleId}/moderate`, { action, note })
    );
  }

  getArticleComments(articleId: string): Promise<DashboardArticleCommentsPayload> {
    return firstValueFrom(this.http.get<DashboardArticleCommentsPayload>(`${API_BASE_URL}/dashboard/articles/${articleId}/comments`));
  }

  moderateArticleComment(articleId: string, commentId: string, action: string, note = ""): Promise<{ comment: DashboardArticleComment | null }> {
    return firstValueFrom(
      this.http.post<{ comment: DashboardArticleComment | null }>(`${API_BASE_URL}/dashboard/articles/${articleId}/comments/${commentId}/moderate`, {
        action,
        note
      })
    );
  }

  uploadArticleImage(payload: { dataUrl: string; filename: string; alt?: string }): Promise<UploadedImagePayload> {
    return firstValueFrom(this.http.post<UploadedImagePayload>(`${API_BASE_URL}/dashboard/uploads/images`, payload));
  }

  getCategories(): Promise<Category[]> {
    return firstValueFrom(this.http.get<Category[]>(`${API_BASE_URL}/dashboard/categories`));
  }

  createCategory(payload: Partial<Category>): Promise<Category> {
    return firstValueFrom(this.http.post<Category>(`${API_BASE_URL}/dashboard/categories`, payload));
  }

  updateCategory(categoryId: string, payload: Partial<Category>): Promise<Category> {
    return firstValueFrom(this.http.put<Category>(`${API_BASE_URL}/dashboard/categories/${categoryId}`, payload));
  }

  getUsers(filters: { search?: string; page?: number; limit?: number } = {}): Promise<PaginatedUsers> {
    let params = new HttpParams();

    if (filters.search?.trim()) {
      params = params.set("search", filters.search.trim());
    }
    if (filters.page) {
      params = params.set("page", filters.page);
    }
    if (filters.limit) {
      params = params.set("limit", filters.limit);
    }

    return firstValueFrom(
      this.http.get<PaginatedUsers>(`${API_BASE_URL}/dashboard/users`, {
        params
      })
    );
  }

  createUser(payload: Record<string, unknown>): Promise<UserSession> {
    return firstValueFrom(this.http.post<UserSession>(`${API_BASE_URL}/dashboard/users`, payload));
  }

  updateUser(userId: string, payload: Record<string, unknown>): Promise<UserSession> {
    return firstValueFrom(this.http.put<UserSession>(`${API_BASE_URL}/dashboard/users/${userId}`, payload));
  }

  deleteUser(userId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.delete<{ message: string }>(`${API_BASE_URL}/dashboard/users/${userId}`));
  }

  getSubscriptions(filters: { search?: string; page?: number; limit?: number } = {}): Promise<PaginatedSubscriptions> {
    let params = new HttpParams();

    if (filters.search?.trim()) {
      params = params.set("search", filters.search.trim());
    }
    if (filters.page) {
      params = params.set("page", filters.page);
    }
    if (filters.limit) {
      params = params.set("limit", filters.limit);
    }

    return firstValueFrom(
      this.http.get<PaginatedSubscriptions>(`${API_BASE_URL}/dashboard/subscriptions`, {
        params
      })
    );
  }

  updateSubscription(subscriptionId: string, payload: { status: SubscriptionEntry["status"] }): Promise<SubscriptionEntry> {
    return firstValueFrom(
      this.http.put<SubscriptionEntry>(`${API_BASE_URL}/dashboard/subscriptions/${subscriptionId}`, payload)
    );
  }

  deleteSubscription(subscriptionId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.delete<{ message: string }>(`${API_BASE_URL}/dashboard/subscriptions/${subscriptionId}`));
  }

  getAuditLogs(): Promise<AuditEntry[]> {
    return firstValueFrom(this.http.get<AuditEntry[]>(`${API_BASE_URL}/dashboard/audit-logs`));
  }
}
