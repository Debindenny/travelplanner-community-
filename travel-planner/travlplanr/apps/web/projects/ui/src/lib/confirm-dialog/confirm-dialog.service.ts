import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmDialogRequest {
  data: ConfirmDialogData;
  resolve: (confirmed: boolean) => void;
}

/**
 * Signal-backed replacement for `MatDialog` scoped to yes/no confirmations —
 * the only dialog use case in the admin app. Render `<lib-confirm-dialog-host />`
 * once near the app root.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly request = signal<ConfirmDialogRequest | null>(null);

  /**
   * Opens the confirmation dialog; mirrors `MatDialog.open(Component, {data}).afterClosed()`
   * so existing call sites only need their injected service swapped.
   */
  confirm(config: { data: ConfirmDialogData }): { afterClosed: () => Observable<boolean> } {
    const observable = new Observable<boolean>((subscriber) => {
      this.request.set({
        data: config.data,
        resolve: (confirmed) => {
          subscriber.next(confirmed);
          subscriber.complete();
        },
      });
    });
    return { afterClosed: () => observable };
  }

  respond(confirmed: boolean): void {
    this.request()?.resolve(confirmed);
    this.request.set(null);
  }
}
