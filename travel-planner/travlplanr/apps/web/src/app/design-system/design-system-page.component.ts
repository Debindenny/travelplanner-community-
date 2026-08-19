import { Component, inject } from '@angular/core';

import {
  PrimaryButtonComponent,
  SecondaryButtonComponent,
  OutlineButtonComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ToastService,
  ConfirmDialogService,
  ThemeService,
} from 'ui';

/**
 * Dev-only living style guide for the shared `ui` library and design tokens.
 * Not linked from any nav — reach it directly at /design-system in a dev build.
 * See DESIGN_ENHANCEMENT_PLAN.md "Design System Unification".
 */
@Component({
    selector: 'app-design-system-page',
    imports: [
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    OutlineButtonComponent,
    SkeletonComponent,
    EmptyStateComponent
],
    template: `
    <div class="min-h-screen bg-surface-muted dark:bg-gray-900 p-8 space-y-12 text-text-primary dark:text-gray-100">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-4xl font-bold">Design System</h1>
          <p class="text-text-secondary dark:text-gray-400 mt-1">
            Living reference for tokens and shared components in <code>projects/ui</code>. Dev-only route.
          </p>
        </div>
        <button
          type="button"
          (click)="theme.toggle()"
          class="rounded-btn border border-border px-4 py-2 text-sm font-medium hover:bg-surface dark:hover:bg-gray-800"
        >
          {{ theme.isDark() ? 'Switch to light' : 'Switch to dark' }}
        </button>
      </header>

      <section>
        <h2 class="text-2xl font-bold mb-4">Colors</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          @for (swatch of colorSwatches; track swatch.name) {
            <div class="rounded-card overflow-hidden border border-border">
              <div class="h-16" [style.background]="swatch.value"></div>
              <div class="p-2 text-xs">
                <div class="font-semibold">{{ swatch.name }}</div>
                <div class="text-text-tertiary dark:text-gray-500">{{ swatch.value }}</div>
              </div>
            </div>
          }
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Type scale</h2>
        <div class="space-y-2">
          @for (size of fontSizes; track size.name) {
            <div class="flex items-baseline gap-4">
              <span class="w-24 shrink-0 text-xs text-text-tertiary dark:text-gray-500">text-{{ size.name }}</span>
              <span [class]="'text-' + size.name">The quick brown fox ({{ size.px }})</span>
            </div>
          }
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Spacing</h2>
        <div class="space-y-3">
          @for (space of spacingTokens; track space.name) {
            <div class="flex items-center gap-4">
              <span class="w-24 shrink-0 text-xs text-text-tertiary dark:text-gray-500">{{ space.name }}</span>
              <div class="bg-primary rounded" [style.width]="space.value" [style.height]="'16px'"></div>
              <span class="text-xs text-text-tertiary dark:text-gray-500">{{ space.value }}</span>
            </div>
          }
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Buttons</h2>
        <div class="flex flex-wrap items-center gap-4">
          <app-primary-button>Primary</app-primary-button>
          <app-secondary-button>Secondary</app-secondary-button>
          <app-outline-button>Outline</app-outline-button>
          <app-primary-button [loading]="true">Loading</app-primary-button>
          <app-primary-button [disabled]="true">Disabled</app-primary-button>
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Skeleton</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <app-skeleton variant="card" />
          <app-skeleton variant="text" width="80%" />
          <app-skeleton variant="chart" height="120px" />
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Empty state</h2>
        <div class="max-w-md border border-border rounded-card">
          <app-empty-state icon="inbox" title="Nothing here yet" subtitle="This is the shared empty-state component." />
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Toast &amp; confirm dialog</h2>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="rounded-btn border border-border px-4 py-2 text-sm" (click)="toast.success('Saved successfully')">
            Trigger success toast
          </button>
          <button type="button" class="rounded-btn border border-border px-4 py-2 text-sm" (click)="toast.error('Something went wrong')">
            Trigger error toast
          </button>
          <button
            type="button"
            class="rounded-btn border border-border px-4 py-2 text-sm"
            (click)="confirmDialog.confirm({ data: { title: 'Confirm action', message: 'Try the shared confirm dialog.', danger: true } }).afterClosed().subscribe()"
          >
            Trigger confirm dialog
          </button>
        </div>
      </section>
    </div>
  `
})
export class DesignSystemPageComponent {
  protected theme = inject(ThemeService);
  protected toast = inject(ToastService);
  protected confirmDialog = inject(ConfirmDialogService);

  protected readonly colorSwatches = [
    { name: 'primary', value: '#0060EA' },
    { name: 'primary-hover', value: '#0860C8' },
    { name: 'danger', value: '#DC2626' },
    { name: 'success', value: '#16A34A' },
    { name: 'warning', value: '#D97706' },
    { name: 'dark', value: '#1A1A1A' },
  ];

  protected readonly fontSizes = [
    { name: '2xs', px: '10px' },
    { name: 'sm', px: '14px' },
    { name: 'base', px: '16px' },
    { name: 'lg', px: '18px' },
    { name: '2xl', px: '22px' },
    { name: '4xl', px: '28px' },
  ];

  protected readonly spacingTokens = [
    { name: 'gutter', value: '16px' },
    { name: 'card', value: '24px' },
    { name: 'section', value: '96px' },
  ];
}
