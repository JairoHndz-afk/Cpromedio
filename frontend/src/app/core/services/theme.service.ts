import { DOCUMENT } from "@angular/common";
import { Injectable, inject, signal } from "@angular/core";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "periodico-theme";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>("light");

  init(): void {
    if (typeof window === "undefined") {
      return;
    }

    const storedMode = window.localStorage.getItem(STORAGE_KEY);
    const preferredMode: ThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const mode = storedMode === "dark" || storedMode === "light" ? storedMode : preferredMode;

    this.apply(mode);
  }

  toggle(): void {
    this.apply(this.mode() === "dark" ? "light" : "dark");
  }

  private apply(mode: ThemeMode): void {
    this.mode.set(mode);
    this.document.documentElement.dataset["theme"] = mode;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }
}
