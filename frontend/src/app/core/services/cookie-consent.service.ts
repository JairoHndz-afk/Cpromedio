import { DOCUMENT } from "@angular/common";
import { Injectable, inject, signal } from "@angular/core";

export interface CookieConsentPreferences {
  essential: true;
  preferences: boolean;
  measurement: boolean;
  version: 1;
  updatedAt: string;
}

export const COOKIE_CONSENT_COOKIE_NAME = "cp_cookie_preferences";
const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;
const THEME_STORAGE_KEY = "periodico-theme";
const ARTICLE_VIEW_COOKIE_NAME = "cp_recent_views";

@Injectable({ providedIn: "root" })
export class CookieConsentService {
  private readonly document = inject(DOCUMENT);

  readonly decision = signal<CookieConsentPreferences | null>(null);

  init(): void {
    if (typeof document === "undefined") {
      return;
    }

    this.decision.set(this.readStoredDecision());
  }

  hasDecision(): boolean {
    return this.decision() !== null;
  }

  allowsPreferenceStorage(): boolean {
    return this.decision()?.preferences === true;
  }

  allowsMeasurement(): boolean {
    return this.decision()?.measurement === true;
  }

  acceptAll(): void {
    this.persist({
      essential: true,
      preferences: true,
      measurement: true,
      version: 1,
      updatedAt: new Date().toISOString()
    });
  }

  acceptEssentialOnly(): void {
    this.persist({
      essential: true,
      preferences: false,
      measurement: false,
      version: 1,
      updatedAt: new Date().toISOString()
    });
  }

  saveCustom(options: { preferences: boolean; measurement: boolean }): void {
    this.persist({
      essential: true,
      preferences: options.preferences,
      measurement: options.measurement,
      version: 1,
      updatedAt: new Date().toISOString()
    });
  }

  private persist(value: CookieConsentPreferences): void {
    this.decision.set(value);

    if (typeof document === "undefined") {
      return;
    }

    const encodedValue = encodeURIComponent(JSON.stringify(value));
    this.document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${encodedValue}; Max-Age=${COOKIE_CONSENT_MAX_AGE}; Path=/; SameSite=Lax`;

    if (!value.preferences && typeof window !== "undefined") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }

    if (!value.measurement) {
      this.document.cookie = `${ARTICLE_VIEW_COOKIE_NAME}=; Max-Age=0; Path=/api/public/articles; SameSite=Strict`;
    }
  }

  private readStoredDecision(): CookieConsentPreferences | null {
    const cookieRow = this.document.cookie
      .split(";")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));

    if (!cookieRow) {
      return null;
    }

    try {
      const rawValue = cookieRow.slice(COOKIE_CONSENT_COOKIE_NAME.length + 1);
      const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<CookieConsentPreferences>;

      if (parsed?.essential !== true || parsed?.version !== 1) {
        return null;
      }

      return {
        essential: true,
        preferences: parsed.preferences === true,
        measurement: parsed.measurement === true,
        version: 1,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
      };
    } catch {
      return null;
    }
  }
}
