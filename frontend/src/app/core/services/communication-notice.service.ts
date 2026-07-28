import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";

import { SiteCommunication } from "../types/api.types";

const COMMUNICATION_NOTICE_COOKIE = "cp_editorial_notice";
const COMMUNICATION_NOTICE_MAX_AGE = 60 * 60 * 24 * 180;

interface CommunicationNoticeCookieValue {
  version: string;
  dismissedAt: string;
}

@Injectable({ providedIn: "root" })
export class CommunicationNoticeService {
  private readonly document = inject(DOCUMENT);

  shouldShow(communication: SiteCommunication | null): boolean {
    if (!communication?.version) {
      return false;
    }

    const current = this.readStoredNotice();

    return current?.version !== communication.version;
  }

  dismiss(communication: SiteCommunication): void {
    if (!this.document || !communication.version) {
      return;
    }

    const maxAge = this.buildCookieMaxAge(communication.expiresAt);
    const payload: CommunicationNoticeCookieValue = {
      version: communication.version,
      dismissedAt: new Date().toISOString()
    };

    this.document.cookie =
      `${COMMUNICATION_NOTICE_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  }

  private buildCookieMaxAge(expiresAt: string): number {
    const expiresAtTime = new Date(expiresAt).getTime();

    if (Number.isNaN(expiresAtTime)) {
      return COMMUNICATION_NOTICE_MAX_AGE;
    }

    const secondsUntilExpiry = Math.floor((expiresAtTime - Date.now()) / 1000);

    return Math.max(60 * 60, Math.min(COMMUNICATION_NOTICE_MAX_AGE, secondsUntilExpiry));
  }

  private readStoredNotice(): CommunicationNoticeCookieValue | null {
    const cookieRow = this.document.cookie
      .split(";")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${COMMUNICATION_NOTICE_COOKIE}=`));

    if (!cookieRow) {
      return null;
    }

    try {
      const rawValue = cookieRow.slice(COMMUNICATION_NOTICE_COOKIE.length + 1);
      const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<CommunicationNoticeCookieValue>;

      if (!parsed?.version || typeof parsed.version !== "string") {
        return null;
      }

      return {
        version: parsed.version,
        dismissedAt: typeof parsed.dismissedAt === "string" ? parsed.dismissedAt : new Date().toISOString()
      };
    } catch {
      return null;
    }
  }
}
