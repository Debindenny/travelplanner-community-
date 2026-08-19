import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

/**
 * Branded, app-wide toast feedback — a signal-backed replacement for
 * MatSnackBar so neither app depends on @angular/material. Render
 * `<lib-toast-host />` once near the app root to display queued toasts.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<ToastMessage[]>([]);

  success(message: string, duration = 4000): void {
    this.open(message, 'success', duration);
  }

  error(message: string, duration = 6000): void {
    this.open(message, 'error', duration);
  }

  info(message: string, duration = 4000): void {
    this.open(message, 'info', duration);
  }

  /** Variant-style convenience used by some callers: `show(msg, 'success')`. */
  show(message: string, variant: ToastVariant = 'info', duration?: number): void {
    if (variant === 'success') this.success(message, duration ?? 4000);
    else if (variant === 'error') this.error(message, duration ?? 6000);
    else this.info(message, duration ?? 4000);
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private open(message: string, variant: ToastVariant, duration: number): void {
    const id = ++this.nextId;
    this.toasts.update((toasts) => [...toasts, { id, message, variant, duration }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
