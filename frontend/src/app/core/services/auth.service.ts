import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { firstValueFrom, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { UserSession } from "../types/api.types";
import { API_BASE_URL } from "./api-base";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<UserSession | null>(null);
  readonly ready = signal(false);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === "admin");
  readonly isReader = computed(() => this.user()?.role === "reader");
  readonly isEditorial = computed(() => this.user()?.role === "admin" || this.user()?.role === "journalist");

  async restoreSession(): Promise<UserSession | null> {
    if (this.ready()) {
      return this.user();
    }

    const restored = await firstValueFrom(
      this.http.get<{ user: UserSession | null }>(`${API_BASE_URL}/auth/me`).pipe(
        map((response) => response.user),
        catchError(() => of(null))
      )
    );

    this.user.set(restored);
    this.ready.set(true);
    return restored;
  }

  async login(payload: { email: string; password: string }): Promise<UserSession> {
    const response = await firstValueFrom(
      this.http.post<{ user: UserSession }>(`${API_BASE_URL}/auth/login`, payload)
    );

    this.user.set(response.user);
    this.ready.set(true);
    return response.user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/logout`, {}));
    this.user.set(null);
    this.ready.set(true);
  }

  applyUser(user: UserSession): void {
    this.user.set(user);
    this.ready.set(true);
  }
}
