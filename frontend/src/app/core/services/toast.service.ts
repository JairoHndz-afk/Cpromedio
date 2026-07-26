import { Injectable, signal } from "@angular/core";

export interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

@Injectable({ providedIn: "root" })
export class ToastService {
  readonly items = signal<ToastItem[]>([]);
  private nextId = 1;

  success(message: string): void {
    this.push("success", message, 4200);
  }

  error(message: string): void {
    this.push("error", message, 7000);
  }

  info(message: string): void {
    this.push("info", message, 5000);
  }

  dismiss(id: number): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  private push(type: ToastItem["type"], message: string, durationMs: number): void {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    const id = this.nextId++;
    this.items.update((items) => [...items, { id, type, message: trimmed }]);

    globalThis.setTimeout(() => {
      this.dismiss(id);
    }, durationMs);
  }
}
