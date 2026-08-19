import { Component, DestroyRef, OnInit, inject, signal, effect, untracked, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../shared/utils/toast.service';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { ProfileService, TravelPreferences, UserProfile } from './profile.service';
import { TripsPageComponent } from '../trip/trips-page.component';
import { PrimaryButtonComponent, SecondaryButtonComponent } from 'ui';

type ProfileTab = 'profile' | 'preferences' | 'trips' | 'notifications' | 'settings';

@Component({
    selector: 'app-profile-page',
    imports: [FormsModule, RouterLink, FooterSectionComponent, TripsPageComponent, NgClass, TranslatePipe, PrimaryButtonComponent, SecondaryButtonComponent],
    template: `
    <div class="min-h-screen bg-surface-muted font-poppins">
      <!-- Banner and Profile Header -->
      <div class="page-container px-4 pt-[34px] xl:px-8">
        <div class="relative overflow-visible rounded-t-[24px] bg-primary group/cover shadow-sm">
          <!-- Cover Background Image/Gradient -->
          @if (coverUrl()) {
            <div class="absolute inset-0 w-full h-[180px] bg-cover bg-fixed bg-center rounded-t-[24px]" [style.backgroundImage]="'url(' + coverUrl() + ')'"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 rounded-t-[24px]"></div>
          } @else {
            <div class="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary rounded-t-[24px]"></div>
          }
          <!-- Banner edit overlay on hover -->
          <label class="absolute right-4 bottom-4 flex cursor-pointer items-center gap-1.5 rounded-btn bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm opacity-0 transition-opacity duration-200 hover:bg-black/80 group-hover/cover:opacity-100">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            {{ 'PROFILE.EDIT_COVER' | translate }}
            <input type="file" class="hidden" accept="image/*" (change)="onCoverSelected($event)" />
          </label>
          <div class="relative h-[180px]"></div>
        </div>

        <!-- Avatar Overlap section -->
        <div class="relative z-10 -mt-16 flex flex-col items-center gap-4 px-6 sm:flex-row sm:items-end sm:px-8">
          <div class="group/avatar relative h-32 w-32 shrink-0 rounded-full p-1 bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 bg-[length:200%_200%] hover:animate-[gradient_3s_ease_infinite] shadow-md transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] cursor-pointer">
            <div class="w-full h-full rounded-full border-4 border-white bg-surface-muted overflow-hidden relative">
              @if (avatarUrl()) {
                <img [src]="avatarUrl()" class="h-full w-full object-cover" [alt]="'PROFILE.AVATAR_ALT' | translate" />
              } @else {
                <div class="flex h-full w-full items-center justify-center bg-primary text-3xl font-bold text-white uppercase select-none">
                  {{ profileDraft.name ? profileDraft.name.slice(0, 1) : 'U' }}
                </div>
              }
            </div>
            <label class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/50 text-2xs-plus font-medium text-white opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100">
              <svg class="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {{ 'PROFILE.CHANGE_PHOTO' | translate }}
              <input type="file" class="hidden" accept="image/*" (change)="onAvatarSelected($event)" />
            </label>
          </div>
          <div class="text-center sm:text-left pb-2">
            <h2 class="text-2xl font-bold text-text-primary">{{ profileDraft.name || ('PROFILE.TRAVELLER' | translate) }}</h2>
            <p class="text-sm text-text-secondary">{{ profileDraft.email }}</p>
          </div>
        </div>
      </div>

      <div class="page-container px-5 pb-16 pt-8 xl:px-20">
        @if (loadError() || preferencesError() || notificationsError()) {
          <div class="mb-4 flex flex-col gap-3 rounded-btn border border-danger/20 bg-danger-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
            <p class="text-sm text-danger">
              {{ loadError() || preferencesError() || notificationsError() }}
            </p>
            <button
              type="button"
              (click)="retryLoad()"
              class="w-fit rounded-btn border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
            >
              {{ 'PROFILE.RETRY' | translate }}
            </button>
          </div>
        }
        <div class="overflow-hidden rounded-btn border border-border-light bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
          <div class="border-b border-border-light px-6 py-6 lg:px-8">
            <h1 class="text-xl font-semibold text-text-primary">{{ tabHeading() | translate }}</h1>
            <p class="mt-1 text-sm text-text-secondary">{{ tabSubtitle() | translate }}</p>
          </div>

          <div class="flex flex-col lg:flex-row">
            <nav
              class="flex gap-2 overflow-x-auto px-4 py-3 lg:w-[240px] lg:shrink-0 lg:flex-col lg:px-6 lg:py-6 relative bg-gray-50/50 lg:bg-transparent rounded-xl mx-4 lg:mx-0 my-4 lg:my-0 shadow-inner lg:shadow-none"
              [attr.aria-label]="'PROFILE.SECTIONS_ARIA' | translate"
              role="tablist"
            >
              @for (item of navItems; track item.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeTab() === item.id"
                  class="flex shrink-0 items-center gap-2 rounded-full lg:rounded-xl px-5 py-2.5 text-left text-sm font-semibold transition-all duration-300 lg:w-full"
                  [class.text-white]="activeTab() === item.id"
                  [class.bg-gradient-to-r]="activeTab() === item.id"
                  [class.from-blue-600]="activeTab() === item.id"
                  [class.to-indigo-600]="activeTab() === item.id"
                  [class.text-text-secondary]="activeTab() !== item.id"
                  [ngClass]="{ 'shadow-[0_4px_15px_rgba(79,70,229,0.3)]': activeTab() === item.id, 'hover:bg-gray-200/50': activeTab() !== item.id }"
                  (click)="selectTab(item.id)"
                >
                  <!-- SVG Icon based on item.id -->
                  @switch (item.id) {
                    @case ('profile') {
                      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    }
                    @case ('preferences') {
                      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    }
                    @case ('trips') {
                      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    }
                    @case ('notifications') {
                      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    }
                    @case ('settings') {
                      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    }
                  }
                  {{ item.label | translate }}
                </button>
              }
            </nav>

            <div class="flex-1 p-6 lg:p-8">
              @switch (activeTab()) {
                @case ('profile') {
                  <section class="animate-fade-in">
                    <h2 class="text-lg font-semibold text-text-primary">{{ 'PROFILE.TRAVELLER' | translate }}</h2>
                    <div class="mt-6 grid gap-6 lg:grid-cols-3">
                      <label class="flex flex-col gap-2">
                        <span class="text-sm font-medium text-text-secondary">{{ 'PROFILE.NAME' | translate }}</span>
                        <div class="relative flex-1">
                          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-tertiary">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </span>
                          <input
                            type="text"
                            [(ngModel)]="profileDraft.name"
                            (ngModelChange)="markProfileDirty()"
                            class="h-11 w-full rounded-btn border border-border pl-10 pr-4 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                          />
                        </div>
                      </label>
                      <label class="flex flex-col gap-2">
                        <span class="text-sm font-medium text-text-secondary">{{ 'PROFILE.EMAIL_ADDRESS' | translate }}</span>
                        <div class="relative flex-1">
                          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-tertiary">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </span>
                          <input
                            type="email"
                            [(ngModel)]="profileDraft.email"
                            readonly
                            class="h-11 w-full rounded-btn border border-border pl-10 pr-4 text-sm text-text-disabled bg-surface-muted outline-none cursor-not-allowed"
                          />
                        </div>
                      </label>
                      <div class="flex flex-col gap-2">
                        <span class="text-sm font-medium text-text-secondary">{{ 'PROFILE.PHONE_NUMBER' | translate }}</span>
                        <div class="flex h-11 overflow-hidden rounded-btn border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
                          <div class="relative flex items-center pl-3 text-text-tertiary pointer-events-none">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          </div>
                          <select
                            [(ngModel)]="profileDraft.countryCode"
                            class="border-r border-border bg-white pl-2 pr-3 text-sm text-text-primary outline-none"
                          >
                            <option value="+91">+ 91</option>
                            <option value="+1">+ 1</option>
                            <option value="+44">+ 44</option>
                            <option value="+61">+ 61</option>
                          </select>
                          <input
                            type="tel"
                            [(ngModel)]="profileDraft.phone"
                            (ngModelChange)="markProfileDirty()"
                            (blur)="validatePhone()"
                            [placeholder]="'PROFILE.PHONE_PLACEHOLDER' | translate"
                            class="min-w-0 flex-1 px-4 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
                          />
                        </div>
                      </div>
                    </div>

                    <div class="mt-6 grid gap-6 lg:grid-cols-3">
                      <label class="flex flex-col gap-2">
                        <span class="text-sm font-medium text-text-secondary">{{ 'PROFILE.GENDER' | translate }}</span>
                        <div class="relative flex-1">
                          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-tertiary">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                          </span>
                          <select
                            [(ngModel)]="profileDraft.gender"
                            (ngModelChange)="markProfileDirty()"
                            class="h-11 w-full rounded-btn border border-border bg-white pl-10 pr-4 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                          >
                            <option value="">{{ 'PROFILE.SELECT_GENDER' | translate }}</option>
                            <option value="male">{{ 'PROFILE.GENDER_MALE' | translate }}</option>
                            <option value="female">{{ 'PROFILE.GENDER_FEMALE' | translate }}</option>
                            <option value="other">{{ 'PROFILE.GENDER_OTHER' | translate }}</option>
                            <option value="prefer-not">{{ 'PROFILE.GENDER_PREFER_NOT' | translate }}</option>
                          </select>
                        </div>
                      </label>
                      <label class="flex flex-col gap-2">
                        <span class="text-sm font-medium text-text-secondary">{{ 'PROFILE.DATE_OF_BIRTH' | translate }}</span>
                        <div class="relative flex-1">
                          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-tertiary">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </span>
                          <input
                            type="date"
                            [(ngModel)]="profileDraft.dateOfBirth"
                            (ngModelChange)="markProfileDirty()"
                            [max]="maxDate"
                            class="h-11 w-full rounded-btn border border-border pl-10 pr-4 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                          />
                        </div>
                      </label>
                      <label class="flex flex-col gap-2">
                        <span class="text-sm font-medium text-text-secondary">{{ 'PROFILE.NATIONALITY' | translate }}</span>
                        <div class="relative flex-1">
                          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-tertiary">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2a2.5 2.5 0 002.5-2.5V14a2 2 0 012-2h.027M12 21a9 9 0 100-18 9 9 0 000 18z" /></svg>
                          </span>
                          <select
                            [(ngModel)]="profileDraft.nationality"
                            (ngModelChange)="markProfileDirty()"
                            class="h-11 w-full rounded-btn border border-border bg-white pl-10 pr-4 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                          >
                            <option value="">{{ 'PROFILE.SELECT_COUNTRY' | translate }}</option>
                            <option value="IN">India</option>
                            <option value="US">United States</option>
                            <option value="GB">United Kingdom</option>
                            <option value="JP">Japan</option>
                            <option value="FR">France</option>
                          </select>
                        </div>
                      </label>
                    </div>

                    <div class="mt-8 flex flex-wrap justify-end gap-3">
                      <app-secondary-button
                        (click)="resetProfile()"
                      >
                        {{ 'PROFILE.CANCEL' | translate }}
                      </app-secondary-button>
                      <app-primary-button
                        [disabled]="savingProfile()"
                        [loading]="savingProfile()"
                        (click)="saveProfile()"
                      >
                        {{ (savingProfile() ? 'PROFILE.SAVING' : 'PROFILE.SAVE') | translate }}
                      </app-primary-button>
                    </div>
                  </section>
                }

                @case ('preferences') {
                  <section class="flex flex-col gap-8">
                    <div>
                      <h3 class="text-base font-medium text-text-primary">{{ 'PROFILE.PREFERRED_DESTINATIONS' | translate }}</h3>
                      <div class="mt-3 flex flex-wrap gap-2">
                        @for (place of preferencesDraft.destinations; track place) {
                          <span
                            class="inline-flex items-center gap-2 rounded-btn border border-text-disabled/30 bg-surface-muted px-3 py-2 text-sm text-text-primary"
                          >
                            {{ place }}
                            <button
                              type="button"
                              class="text-text-tertiary hover:text-text-primary"
                              [attr.aria-label]="'PROFILE.REMOVE_ITEM' | translate:{item: place}"
                              (click)="removeDestination(place)"
                            >
                              ×
                            </button>
                          </span>
                        }
                        @if (showDestinationInput()) {
                          <input
                            type="text"
                            [(ngModel)]="newDestination"
                            (keydown.enter)="addDestination()"
                            (blur)="addDestination()"
                            [attr.aria-label]="'PROFILE.ADD_DESTINATION' | translate"
                            [placeholder]="'PROFILE.CITY_NAME_PLACEHOLDER' | translate"
                            class="h-10 rounded-btn border border-border px-3 text-sm outline-none"
                          />
                        } @else {
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 rounded-btn border border-text-disabled/30 bg-white px-3 py-2 text-sm text-text-primary"
                            (click)="showDestinationInput.set(true)"
                          >
                            + {{ 'PROFILE.ADD' | translate }}
                          </button>
                        }
                      </div>
                    </div>

                    <div>
                      <h3 class="text-base font-medium text-text-primary">{{ 'PROFILE.PREFERRED_ACTIVITIES' | translate }}</h3>
                      <div class="mt-3 flex flex-wrap gap-2">
                        @for (activity of preferencesDraft.activities; track activity) {
                          <span
                            class="inline-flex items-center gap-2 rounded-btn border border-text-disabled/30 bg-surface-muted px-3 py-2 text-sm text-text-primary"
                          >
                            {{ activity }}
                            <button
                              type="button"
                              class="text-text-tertiary hover:text-text-primary"
                              [attr.aria-label]="'PROFILE.REMOVE_ITEM' | translate:{item: activity}"
                              (click)="removeActivity(activity)"
                            >
                              ×
                            </button>
                          </span>
                        }
                        @if (showActivityInput()) {
                          <input
                            type="text"
                            [(ngModel)]="newActivity"
                            (keydown.enter)="addActivity()"
                            (blur)="addActivity()"
                            [attr.aria-label]="'PROFILE.ADD_ACTIVITY' | translate"
                            [placeholder]="'PROFILE.ACTIVITY_PLACEHOLDER' | translate"
                            class="h-10 rounded-btn border border-border px-3 text-sm outline-none"
                          />
                        } @else {
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 rounded-btn border border-text-disabled/30 bg-white px-3 py-2 text-sm text-text-primary"
                            (click)="showActivityInput.set(true)"
                          >
                            + {{ 'PROFILE.ADD' | translate }}
                          </button>
                        }
                      </div>
                    </div>

                    <div class="grid gap-6 lg:grid-cols-2">
                      <label class="flex flex-col gap-2">
                        <span class="text-base font-medium text-text-primary">{{ 'PROFILE.TRAVEL_STYLE' | translate }}</span>
                        <select
                          [(ngModel)]="preferencesDraft.travelStyle"
                          (ngModelChange)="markPreferencesDirty()"
                          class="h-11 rounded-btn border border-border bg-white px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        >
                          <option value="Budget">{{ 'PROFILE.STYLE_BUDGET' | translate }}</option>
                          <option value="Standard">{{ 'PROFILE.STYLE_STANDARD' | translate }}</option>
                          <option value="Luxury">{{ 'PROFILE.STYLE_LUXURY' | translate }}</option>
                        </select>
                      </label>
                      <label class="flex flex-col gap-2">
                        <span class="text-base font-medium text-text-primary">{{ 'PROFILE.ACCOMMODATION' | translate }}</span>
                        <select
                          [(ngModel)]="preferencesDraft.accommodation"
                          (ngModelChange)="markPreferencesDirty()"
                          class="h-11 rounded-btn border border-border bg-white px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        >
                          <option value="Hotels">{{ 'PROFILE.ACCOMMODATION_HOTELS' | translate }}</option>
                          <option value="Hostels">{{ 'PROFILE.ACCOMMODATION_HOSTELS' | translate }}</option>
                          <option value="Vacation Rentals">{{ 'PROFILE.ACCOMMODATION_VACATION_RENTALS' | translate }}</option>
                        </select>
                      </label>
                      <label class="flex flex-col gap-2">
                        <span class="text-base font-medium text-text-primary">{{ 'PROFILE.TRANSPORT' | translate }}</span>
                        <select
                          [(ngModel)]="preferencesDraft.transport"
                          (ngModelChange)="markPreferencesDirty()"
                          class="h-11 rounded-btn border border-border bg-white px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        >
                          <option value="Flight">{{ 'PROFILE.TRANSPORT_FLIGHT' | translate }}</option>
                          <option value="Train">{{ 'PROFILE.TRANSPORT_TRAIN' | translate }}</option>
                          <option value="Car">{{ 'PROFILE.TRANSPORT_CAR' | translate }}</option>
                          <option value="Mixed">{{ 'PROFILE.TRANSPORT_MIXED' | translate }}</option>
                        </select>
                      </label>
                      <label class="flex flex-col gap-2">
                        <span class="text-base font-medium text-text-primary">{{ 'PROFILE.CURRENCY' | translate }}</span>
                        <select
                          [(ngModel)]="preferencesDraft.currency"
                          (ngModelChange)="markPreferencesDirty()"
                          class="h-11 rounded-btn border border-border bg-white px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <h3 class="text-base font-medium text-text-primary">{{ 'PROFILE.DIETARY_PREFERENCES' | translate }}</h3>
                      <div class="mt-3 flex flex-wrap gap-4">
                        @for (option of dietaryOptions; track option.id) {
                          <label class="inline-flex items-center gap-2 text-sm text-text-secondary">
                            <input
                              type="checkbox"
                              [checked]="preferencesDraft.dietary.includes(option.id)"
                              (change)="toggleDietary(option.id)"
                              class="h-4 w-4 rounded border-border text-primary"
                            />
                            {{ option.labelKey | translate }}
                          </label>
                        }
                      </div>
                    </div>

                    <div class="flex flex-wrap justify-end gap-3">
                      <app-secondary-button
                        (click)="resetPreferences()"
                      >
                        {{ 'PROFILE.CANCEL' | translate }}
                      </app-secondary-button>
                      <app-primary-button
                        [disabled]="savingPreferences()"
                        [loading]="savingPreferences()"
                        (click)="savePreferences()"
                      >
                        {{ (savingPreferences() ? 'PROFILE.SAVING' : 'PROFILE.SAVE_PREFERENCE') | translate }}
                      </app-primary-button>
                    </div>
                  </section>
                }

                @case ('notifications') {
                  <section class="flex flex-col gap-4">
                    @for (item of notificationSettingsDraft; track item.id) {
                      <label
                        class="flex items-center justify-between gap-4 rounded-btn border border-border-light px-4 py-4"
                      >
                        <div>
                          <p class="text-sm font-medium text-text-primary">{{ item.label }}</p>
                          <p class="mt-1 text-xs-plus text-text-secondary">{{ item.description }}</p>
                        </div>
                        <input
                          type="checkbox"
                          [(ngModel)]="item.enabled"
                          (change)="saveNotifications()"
                          class="h-4 w-4 rounded border-border text-primary"
                        />
                      </label>
                    }
                  </section>
                }

                @case ('trips') {
                  <section class="flex flex-col gap-4 w-full">
                    <app-trips-page [embedded]="true" />
                  </section>
                }

                @case ('settings') {
                  <section class="flex flex-col gap-4">
                    <div class="rounded-btn border border-border-light px-4 py-4">
                      <p class="text-sm font-medium text-text-primary">{{ 'PROFILE.LANGUAGE' | translate }}</p>
                      <p class="mt-1 text-xs-plus text-text-secondary">English (En)</p>
                    </div>
                    <div class="rounded-btn border border-border-light px-4 py-4">
                      <p class="text-sm font-medium text-text-primary">{{ 'PROFILE.ACCOUNT' | translate }}</p>
                      <p class="mt-1 text-xs-plus text-text-secondary">{{ auth.user()?.email }}</p>
                    </div>
                    <button
                      type="button"
                      class="mt-2 w-fit rounded-btn border border-border px-5 py-2.5 text-sm font-medium text-text-primary"
                      (click)="logout()"
                    >
                      {{ 'PROFILE.LOG_OUT' | translate }}
                    </button>
                  </section>
                }
              }
            </div>
          </div>
        </div>
      </div>

      <app-footer-section />
    </div>
  `,
    styles: [`
    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `]
})
export class ProfilePageComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly loadError = this.profileService.loadError;
  readonly preferencesError = this.profileService.preferencesError;
  readonly notificationsError = this.profileService.notificationsError;

  readonly avatarUrl = computed(() => this.profileService.profile()?.avatarUrl || null);
  readonly coverUrl = computed(() => this.profileService.profile()?.coverUrl || null);
  readonly maxDate = new Date().toISOString().split('T')[0];

  retryLoad(): void {
    this.profileService.reload();
  }

  readonly navItems: { id: ProfileTab; label: string }[] = [
    { id: 'profile', label: 'PROFILE.NAV_PROFILE' },
    { id: 'preferences', label: 'PROFILE.NAV_PREFERENCES' },
    { id: 'trips', label: 'PROFILE.NAV_TRIPS' },
    { id: 'notifications', label: 'PROFILE.NAV_NOTIFICATIONS' },
    { id: 'settings', label: 'PROFILE.NAV_SETTINGS' },
  ];

  readonly dietaryOptions = [
    { id: 'vegetarian', labelKey: 'PROFILE.DIETARY_VEGETARIAN' },
    { id: 'vegan', labelKey: 'PROFILE.DIETARY_VEGAN' },
    { id: 'halal', labelKey: 'PROFILE.DIETARY_HALAL' },
    { id: 'jain', labelKey: 'PROFILE.DIETARY_JAIN' },
    { id: 'gluten-free', labelKey: 'PROFILE.DIETARY_GLUTEN_FREE' },
    { id: 'no-preference', labelKey: 'PROFILE.DIETARY_NO_PREFERENCE' },
  ];

  notificationSettingsDraft = [...this.profileService.notifications()];

  readonly activeTab = signal<ProfileTab>(this.resolveInitialTab());
  readonly showDestinationInput = signal(false);
  readonly showActivityInput = signal(false);

  profileDraft: UserProfile = this.profileService.resetProfileDraft();
  preferencesDraft: TravelPreferences = this.profileService.resetPreferencesDraft();
  newDestination = '';
  newActivity = '';

  readonly savingProfile = signal(false);
  readonly savingPreferences = signal(false);

  profileDirty = false;
  preferencesDirty = false;
  notificationsDirty = false;

  constructor() {
    const email = this.auth.user()?.email;
    if (email && !localStorage.getItem('travlplanr_profile')) {
      this.profileDraft.email = email;
    }
    
    effect(() => {
      const notifs = this.profileService.notifications();
      const p = this.profileService.profile();
      const prefs = this.profileService.preferences();
      untracked(() => {
        if (!this.notificationsDirty) this.notificationSettingsDraft = JSON.parse(JSON.stringify(notifs));
        if (p && !this.profileDirty) this.profileDraft = { ...p };
        if (prefs && !this.preferencesDirty) {
          this.preferencesDraft = {
            ...prefs,
            destinations: [...prefs.destinations],
            activities: [...prefs.activities],
            dietary: [...prefs.dietary],
          };
        }
      });
    });
  }

  tabHeading(): string {
    switch (this.activeTab()) {
      case 'preferences':
        return 'PROFILE.HEADING_PREFERENCES';
      case 'trips':
        return 'PROFILE.HEADING_TRIPS';
      case 'notifications':
        return 'PROFILE.HEADING_NOTIFICATIONS';
      case 'settings':
        return 'PROFILE.HEADING_SETTINGS';
      default:
        return 'PROFILE.HEADING_PROFILE';
    }
  }

  tabSubtitle(): string {
    switch (this.activeTab()) {
      case 'preferences':
        return 'PROFILE.SUBTITLE_PREFERENCES';
      case 'trips':
        return 'PROFILE.SUBTITLE_TRIPS';
      case 'notifications':
        return 'PROFILE.SUBTITLE_NOTIFICATIONS';
      case 'settings':
        return 'PROFILE.SUBTITLE_SETTINGS';
      default:
        return 'PROFILE.SUBTITLE_PROFILE';
    }
  }

  selectTab(tab: ProfileTab): void {
    if (this.profileDirty || this.preferencesDirty) {
      if (!confirm(this.translate.instant('PROFILE.CONFIRM_DISCARD_TABS'))) {
        return;
      }
      this.resetProfile();
      this.resetPreferences();
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'profile' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        await this.profileService.uploadAvatar(file);
        this.toast.show(this.translate.instant('PROFILE.TOAST_AVATAR_UPDATED'), 'success');
      } catch (e: any) {
        this.toast.show(e?.message || this.translate.instant('PROFILE.TOAST_AVATAR_FAILED'), 'error');
      }
    }
  }

  async onCoverSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        await this.profileService.uploadCover(file);
        this.toast.show(this.translate.instant('PROFILE.TOAST_COVER_UPDATED'), 'success');
      } catch (e: any) {
        this.toast.show(e?.message || this.translate.instant('PROFILE.TOAST_COVER_FAILED'), 'error');
      }
    }
  }

  validatePhone(): void {
    const phone = this.profileDraft.phone;
    if (phone) {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 5 || digitsOnly.length > 15) {
        this.toast.show(this.translate.instant('PROFILE.TOAST_INVALID_PHONE'), 'error');
      }
    }
  }

  markPreferencesDirty(): void {
    this.preferencesDirty = true;
  }

  async saveProfile(): Promise<void> {
    this.savingProfile.set(true);
    try {
      await this.profileService.updateProfile({ ...this.profileDraft });
      this.toast.show(this.translate.instant('PROFILE.TOAST_PROFILE_UPDATED'), 'success');
      this.profileDirty = false;
    } catch (e: any) {
      this.toast.show(e?.message || this.translate.instant('PROFILE.TOAST_PROFILE_FAILED'), 'error');
    } finally {
      this.savingProfile.set(false);
    }
  }

  resetProfile(): void {
    this.profileDraft = this.profileService.resetProfileDraft();
    this.profileDirty = false;
  }

  markProfileDirty(): void {
    this.profileDirty = true;
  }

  async savePreferences(): Promise<void> {
    this.savingPreferences.set(true);
    try {
      await this.profileService.updatePreferences({
        ...this.preferencesDraft,
        destinations: [...this.preferencesDraft.destinations],
        activities: [...this.preferencesDraft.activities],
        dietary: [...this.preferencesDraft.dietary],
      });
      this.toast.show(this.translate.instant('PROFILE.TOAST_PREFERENCES_UPDATED'), 'success');
      this.preferencesDirty = false;
    } catch (e: any) {
      this.toast.show(e?.message || this.translate.instant('PROFILE.TOAST_PREFERENCES_FAILED'), 'error');
    } finally {
      this.savingPreferences.set(false);
    }
  }

  resetPreferences(): void {
    this.preferencesDraft = this.profileService.resetPreferencesDraft();
    this.preferencesDirty = false;
  }

  async saveNotifications(): Promise<void> {
    try {
      await this.profileService.updateNotifications(this.notificationSettingsDraft);
      this.toast.show(this.translate.instant('PROFILE.TOAST_NOTIFICATIONS_UPDATED'), 'success');
      this.notificationsDirty = false;
    } catch (e: any) {
      this.toast.show(e?.message || this.translate.instant('PROFILE.TOAST_NOTIFICATIONS_FAILED'), 'error');
    }
  }

  addDestination(): void {
    const value = this.newDestination.trim();
    if (value && !this.preferencesDraft.destinations.includes(value)) {
      this.preferencesDraft.destinations.push(value);
      this.markPreferencesDirty();
    }
    this.newDestination = '';
    this.showDestinationInput.set(false);
  }

  removeDestination(place: string): void {
    this.preferencesDraft.destinations = this.preferencesDraft.destinations.filter((d) => d !== place);
    this.markPreferencesDirty();
  }

  addActivity(): void {
    const value = this.newActivity.trim();
    if (value && !this.preferencesDraft.activities.includes(value)) {
      this.preferencesDraft.activities.push(value);
      this.markPreferencesDirty();
    }
    this.newActivity = '';
    this.showActivityInput.set(false);
  }

  removeActivity(activity: string): void {
    this.preferencesDraft.activities = this.preferencesDraft.activities.filter((a) => a !== activity);
    this.markPreferencesDirty();
  }

  toggleDietary(id: string): void {
    const list = this.preferencesDraft.dietary;
    if (list.includes(id)) {
      this.preferencesDraft.dietary = list.filter((item) => item !== id);
    } else {
      this.preferencesDraft.dietary = [...list, id];
    }
    this.markPreferencesDirty();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  private resolveInitialTab(): ProfileTab {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'preferences' || tab === 'notifications' || tab === 'settings' || tab === 'trips') {
      return tab;
    }
    return 'profile';
  }

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = params['tab'] as ProfileTab | undefined;
      const valid: ProfileTab[] = ['profile', 'preferences', 'trips', 'notifications', 'settings'];
      const next: ProfileTab = tab && valid.includes(tab) ? tab : 'profile';
      if (this.activeTab() !== next) {
        this.activeTab.set(next);
      }
    });
  }

  canDeactivate(): boolean {
    if (this.profileDirty || this.preferencesDirty || this.notificationsDirty) {
      return confirm(this.translate.instant('PROFILE.CONFIRM_LEAVE'));
    }
    return true;
  }
}
