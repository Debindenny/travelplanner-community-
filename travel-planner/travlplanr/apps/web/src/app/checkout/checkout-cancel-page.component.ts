import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PrimaryButtonComponent } from 'ui';

@Component({
    selector: 'app-checkout-cancel-page',
    imports: [RouterLink, TranslatePipe, PrimaryButtonComponent],
    template: `
    <div class="min-h-[70vh] flex items-center justify-center bg-surface-muted px-4 py-16">
      <div class="max-w-md w-full bg-white rounded-2xl border border-border p-8 shadow-xl text-center transform transition-all scale-100 duration-300">
        <!-- Cancel Icon -->
        <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-rose-50 border-4 border-rose-100 text-rose-600 mb-6">
          <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 class="text-3xl font-extrabold text-text-primary tracking-tight mb-2">
          {{ 'CHECKOUT.CANCEL.TITLE' | translate }}
        </h1>
        
        <p class="text-text-secondary text-base mb-8 leading-relaxed">
          {{ 'CHECKOUT.CANCEL.SUBTITLE' | translate }}
        </p>

        <div class="flex flex-col gap-3">
          <app-primary-button routerLink="/pricing" widthClass="w-full">
            {{ 'CHECKOUT.CANCEL.BACK_TO_PRICING' | translate }}
          </app-primary-button>
          
          <a routerLink="/" class="text-sm font-bold text-primary hover:text-primary-hover hover:underline transition-colors mt-2">
            {{ 'CHECKOUT.CANCEL.BACK_HOME' | translate }}
          </a>
        </div>
      </div>
    </div>
  `
})
export class CheckoutCancelPageComponent {}
