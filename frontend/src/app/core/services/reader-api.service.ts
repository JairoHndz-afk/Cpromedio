import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ReaderAccountPayload, ReaderOwnComment, ReaderSubscriptionAccessPayload, UploadedImagePayload, UserSession } from "../types/api.types";
import { API_BASE_URL } from "./api-base";

@Injectable({ providedIn: "root" })
export class ReaderApiService {
  private readonly http = inject(HttpClient);

  register(payload: { name: string; email: string; password: string; confirmPassword: string }): Promise<{ message: string; user: UserSession }> {
    return firstValueFrom(this.http.post<{ message: string; user: UserSession }>(`${API_BASE_URL}/reader/register`, payload));
  }

  getSubscriptionAccess(token: string): Promise<ReaderSubscriptionAccessPayload> {
    return firstValueFrom(this.http.get<ReaderSubscriptionAccessPayload>(`${API_BASE_URL}/reader/access?token=${encodeURIComponent(token)}`));
  }

  createFromSubscriptionAccess(payload: { token: string; name: string; password: string; confirmPassword: string }): Promise<{ message: string; user: UserSession }> {
    return firstValueFrom(this.http.post<{ message: string; user: UserSession }>(`${API_BASE_URL}/reader/access`, payload));
  }

  getAccount(): Promise<ReaderAccountPayload> {
    return firstValueFrom(this.http.get<ReaderAccountPayload>(`${API_BASE_URL}/reader/me`));
  }

  updateProfile(payload: { name: string; avatarUrl?: string; avatarAlt?: string }): Promise<{ user: UserSession }> {
    return firstValueFrom(this.http.put<{ user: UserSession }>(`${API_BASE_URL}/reader/me`, payload));
  }

  changePassword(payload: { currentPassword: string; nextPassword: string; confirmPassword: string }): Promise<{ message: string }> {
    return firstValueFrom(this.http.put<{ message: string }>(`${API_BASE_URL}/reader/me/password`, payload));
  }

  uploadAvatar(payload: { dataUrl: string; filename: string; alt?: string }): Promise<UploadedImagePayload> {
    return firstValueFrom(this.http.post<UploadedImagePayload>(`${API_BASE_URL}/dashboard/uploads/images`, payload));
  }

  getOwnComments(): Promise<{ items: ReaderOwnComment[] }> {
    return firstValueFrom(this.http.get<{ items: ReaderOwnComment[] }>(`${API_BASE_URL}/reader/me/comments`));
  }

  updateOwnComment(commentId: string, payload: { body: string }): Promise<{ comment: ReaderOwnComment }> {
    return firstValueFrom(this.http.put<{ comment: ReaderOwnComment }>(`${API_BASE_URL}/reader/me/comments/${commentId}`, payload));
  }

  deleteOwnComment(commentId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.delete<{ message: string }>(`${API_BASE_URL}/reader/me/comments/${commentId}`));
  }
}
