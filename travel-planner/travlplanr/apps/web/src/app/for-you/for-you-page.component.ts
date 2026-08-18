import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PrimaryButtonComponent } from 'ui';
import { ProfileService } from '../profile/profile.service';
import { apiUrl } from '../shared/utils/api-url';
import { CurrencyConverterPipe } from '../shared/utils/currency-converter.pipe';

@Component({
    selector: 'app-for-you-page',
    imports: [RouterLink, PrimaryButtonComponent, CurrencyConverterPipe, TranslatePipe],
    template: `
    <div class="section-container py-10">
      <h1 class="text-8xl font-bold leading-none text-text-primary">{{ 'FORYOU.TITLE' | translate }}</h1>
      <p class="mt-2 text-lg text-text-secondary">
        {{ 'FORYOU.SUBTITLE' | translate }}
      </p>

      @if (loading()) {
        <div class="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          @for (s of [1,2,3]; track s) {
            <div class="h-[320px] animate-pulse rounded-card border border-border bg-surface-muted"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-10 rounded-card border border-dashed border-border bg-white p-12 text-center">
          <p class="text-lg font-semibold text-text-primary">{{ 'FORYOU.ERROR_TITLE' | translate }}</p>
          <p class="mt-2 text-base text-text-secondary">{{ error() }}</p>
          <app-primary-button widthClass="mt-6" (click)="load()">{{ 'FORYOU.TRY_AGAIN' | translate }}</app-primary-button>
        </div>
      } @else if (packages().length === 0) {
        <div class="mt-10 rounded-card border border-dashed border-border bg-white p-12 text-center">
          <p class="text-lg font-semibold text-text-primary">{{ 'FORYOU.NO_MATCHES_TITLE' | translate }}</p>
          <p class="mt-2 text-base text-text-secondary">{{ 'FORYOU.NO_MATCHES_TEXT' | translate }}</p>
          <app-primary-button routerLink="/profile" widthClass="mt-6">{{ 'FORYOU.UPDATE_PREFERENCES' | translate }}</app-primary-button>
        </div>
      } @else {
        <div class="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          @for (pkg of packages(); track pkg.id || pkg.title) {
            <article class="overflow-hidden rounded-card border border-border bg-white">
              <img [src]="pkg.image || 'assets/images/landing/journey-thailand.jpg'" [alt]="pkg.title" class="h-[200px] w-full object-cover" />
              <div class="p-5">
                <h2 class="text-lg font-semibold">{{ pkg.title }}</h2>
                <p class="mt-1 text-sm text-text-secondary">{{ (pkg.price || 50000) | appCurrency }}/PP · {{ pkg.days || '5 Days' }}</p>
                <app-primary-button routerLink="/explore" widthClass="mt-4 w-full text-sm">
                  {{ 'FORYOU.CUSTOMIZE_TRIP' | translate }}
                </app-primary-button>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `
})
export class ForYouPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly profile = inject(ProfileService);
  private readonly translate = inject(TranslateService);
  readonly packages = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    const prefs = this.profile.preferences();
    const tags = [
      ...(prefs.destinations || []),
      ...(prefs.activities || []),
      prefs.travelStyle
    ].filter(Boolean).join(',');

    try {
      const url = tags ? `/packages?tags=${encodeURIComponent(tags)}` : '/packages';
      const pkgs = await firstValueFrom(this.http.get<any[]>(apiUrl(url)));
      this.packages.set(pkgs.slice(0, 6)); // Show top 6 matches
    } catch (e) {
      console.error('Failed to load personalized packages', e);
      this.error.set(this.translate.instant('FORYOU.LOAD_ERROR'));
    } finally {
      this.loading.set(false);
    }
  }
}
