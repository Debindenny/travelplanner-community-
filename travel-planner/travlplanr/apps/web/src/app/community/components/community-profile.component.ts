import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FooterSectionComponent } from '../../landing/components/footer-section/footer-section.component';
import { CommunityProfileService, UserProfile } from '../services/community-profile.service';
import { CommunityFollowersModalComponent, FollowersModalMode } from './community-followers-modal.component';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/utils/toast.service';

type ProfileTab = 'posts' | 'trips' | 'photos';

@Component({
    selector: 'app-community-profile',
    imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, FooterSectionComponent, CommunityFollowersModalComponent],
    template: `
    <div class="min-h-screen bg-neutral-50 flex flex-col">
      <main class="flex-1 flex justify-center pt-4 pb-12 px-3 sm:px-4">
        <div class="w-full max-w-5xl">

          @if (loading()) {
            <div class="flex justify-center items-center py-20">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          } @else if (profile()) {

            <!-- ============ HEADER: Back button ============ -->
            <div class="flex items-center justify-between mb-4">
              <button
                (click)="goBack()"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                {{ 'COMMUNITY.PROFILE.BACK' | translate }}
              </button>
            </div>

            <!-- ============ COVER BANNER ============ -->
            <div class="relative h-48 sm:h-[220px] mx-4 sm:mx-10 rounded-[24px] overflow-hidden bg-gradient-to-br from-gray-300 via-gray-200 to-gray-300 border border-gray-200/70 shadow-sm">
              <!-- Destination badge (top right) -->
              @if (profile()?.local_in) {
                <span class="absolute top-4 right-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/95 border border-gray-200 shadow-sm backdrop-blur-sm text-xs font-semibold text-gray-800">
                  <svg class="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {{ profile()?.local_in }}
                </span>
              }
            </div>=

            <!-- ============ PROFILE HEADER: avatar + name + actions + stats ============ -->
            <div class="relative z-10 bg-white rounded-[24px] shadow-sm border border-gray-100/80 mx-4 sm:mx-10 -mt-12 sm:-mt-14 px-5 sm:px-8 pb-1">
              <div class="flex flex-wrap items-center gap-x-5">
                <!-- Avatar -->
                <div class="relative group -mt-20 sm:-mt-24 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden shrink-0">
                  <img [src]="profile()?.avatar || '/assets/images/default-avatar.svg'" [alt]="'COMMUNITY.PROFILE.AVATAR_ALT' | translate" class="w-full h-full object-cover" loading="lazy" decoding="async" />
                  @if (isSelf()) {
                    <label class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                      <input type="file" class="hidden" [attr.aria-label]="'COMMUNITY.PROFILE.AVATAR_UPLOAD_ARIA_LABEL' | translate" accept="image/jpeg,image/png,image/webp" (change)="onAvatarSelected($event)" [disabled]="uploadingAvatar()" />
                    </label>
                    @if (uploadingAvatar()) {
                      <div class="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full">
                        <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                      </div>
                    }
                  }
                </div>

                <!-- Name + subtitle -->
                <div class="flex-1 min-w-[200px]">
                  <div class="flex items-center gap-2">
                    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">{{ profile()?.name }}</h1>
                    @if (profile()?.is_verified) {
                      <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      </span>
                    }
                  </div>
                  @if (profileSubtitle()) {
                    <p class="text-sm text-gray-500 mt-1">{{ profileSubtitle() }}</p>
                  }
                </div>

                <!-- Edit profile / Follow -->
                <div class="ml-auto shrink-0">
                  @if (isSelf()) {
                    <button
                      (click)="openEditModal()"
                      class="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200/70 transition-colors"
                    >
                      {{ 'COMMUNITY.PROFILE.EDIT_PROFILE' | translate }}
                    </button>
                  } @else {
                    <button
                      (click)="toggleFollow()"
                      [disabled]="togglingFollow()"
                      class="px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                      [ngClass]="profile()?.is_following ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-300' : 'bg-primary text-white hover:bg-blue-700 focus:ring-primary'"
                    >
                      {{ (profile()?.is_following ? 'COMMUNITY.PROFILE.FOLLOWING_BUTTON' : 'COMMUNITY.PROFILE.FOLLOW_BUTTON') | translate }}
                    </button>
                  }
                </div>
              </div>

              <!-- ============ STATS: 4 equal-width columns ============ -->
              <div class="mt-6 grid grid-cols-4 divide-x divide-gray-200/70 border-t border-gray-200/70">
                <div class="text-center py-4 px-2 min-w-0">
                  <button type="button" (click)="openFollowersModal('followers')" class="w-full flex flex-col items-center group focus:outline-none">
                    <span class="block text-2xl font-extrabold text-gray-900 whitespace-nowrap group-hover:text-primary transition-colors">{{ profile()?.followers_count ?? 0 }}</span>
                    <span class="block text-xs font-medium text-gray-500 mt-1 whitespace-nowrap group-hover:text-gray-700 transition-colors">{{ 'COMMUNITY.PROFILE.FOLLOWERS_LABEL' | translate }}</span>
                  </button>
                </div>
                <div class="text-center py-4 px-2 min-w-0">
                  <button type="button" (click)="openFollowersModal('following')" class="w-full flex flex-col items-center group focus:outline-none">
                    <span class="block text-2xl font-extrabold text-gray-900 whitespace-nowrap group-hover:text-primary transition-colors">{{ profile()?.following_count ?? 0 }}</span>
                    <span class="block text-xs font-medium text-gray-500 mt-1 whitespace-nowrap group-hover:text-gray-700 transition-colors">{{ 'COMMUNITY.PROFILE.FOLLOWING_LABEL' | translate }}</span>
                  </button>
                </div>
                <div class="text-center py-4 px-2 min-w-0">
                  <span class="block text-2xl font-extrabold text-gray-900 whitespace-nowrap">{{ profile()?.helpful_count ?? 0 }}</span>
                  <span class="block text-xs font-medium text-gray-500 mt-1 whitespace-nowrap">{{ 'COMMUNITY.PROFILE.FOUND_HELPFUL' | translate }}</span>
                </div>
                <div class="text-center py-4 px-2 min-w-0">
                  <span class="block text-2xl font-extrabold text-gray-900 whitespace-nowrap">{{ profile()?.countries_visited ?? 0 }}</span>
                  <span class="block text-xs font-medium text-gray-500 mt-1 whitespace-nowrap">{{ 'COMMUNITY.PROFILE.COUNTRIES' | translate }}</span>
                </div>
              </div>
            </div>

            <!-- ============ CONTENT GRID: sidebar + feed ============ -->
            <div class="mx-4 sm:mx-10 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

              <!-- LEFT SIDEBAR -->
              <div class="lg:col-span-4 space-y-6">
                <!-- ABOUT + IN COMMON -->
                <section class="bg-neutral-50 rounded-2xl border border-gray-200/80 py-5 px-5">
                  <h2 class="text-[11px] font-bold uppercase tracking-widest text-primary mb-4">
                    <span>{{ 'COMMUNITY.PROFILE.ABOUT' | translate }}</span>
                  </h2>
                  <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{{ profile()?.about || profile()?.bio || ('COMMUNITY.PROFILE.ABOUT_EMPTY' | translate) }}</p>
                  @if (interests().length > 0) {
                    <div class="flex flex-wrap gap-2 mt-4">
                      @for (interest of interests(); track interest) {
  <span class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700">

    @switch (interest) {
      @case ('Museums') {
        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 10l9-6 9 6M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16"/>
        </svg>
      }

      @case ('Food') {
        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 3v8M12 3v8M8 7h4M16 3v18"/>
        </svg>
      }

      @case ('Walking') {
        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="5" r="2"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 7v6l3 3M12 13l-3 4"/>
        </svg>
      }

      @default {
        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01"/>
        </svg>
      }
    }

    {{ interest }}
  </span>
}
                    </div>
                  }

                  <!-- Divider between About and In Common -->
                  <div class="my-5 border-t border-gray-200" aria-hidden="true"></div>
                  <h3 class="text-[11px] font-bold uppercase tracking-widest text-primary mb-3.5">
                    <span>{{ 'COMMUNITY.PROFILE.IN_COMMON' | translate }}</span>
                  </h3>
                  @if (commonCount() === 0) {
                    <p class="text-sm text-gray-400">{{ 'COMMUNITY.PROFILE.IN_COMMON_NONE' | translate }}</p>
                  } @else {
                    <ul class="space-y-3.5">
                      @if (mutualFollowText()) {
                        <li>
                          <button
                            type="button"
                            (click)="openFollowersModal('followers')"
                            class="w-full flex items-start gap-2.5 text-sm text-gray-600 leading-snug text-left group focus:outline-none"
                          >
                            <svg class="w-4 h-4 text-gray-400 mt-0.5 shrink-0 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <span>{{ mutualFollowText() }}</span>
                          </button>
                        </li>
                      }
                      @if (overlapText()) {
                        <li class="flex items-start gap-2.5 text-sm text-gray-600 leading-snug">
                          <svg class="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>{{ overlapText() }}</span>
                        </li>
                      }
                      @if (circlesText()) {
                        <li class="flex items-start gap-2.5 text-sm text-gray-600 leading-snug">
                          <svg class="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                          <span>{{ circlesText() }}</span>
                        </li>
                      }
                      @if (helpfulText()) {
                        <li class="flex items-start gap-2.5 text-sm text-gray-600 leading-snug">
                          <svg class="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.26 21h-4.017a2 2 0 01-2-2v-5a2 2 0 012-2h2l1.79-5.372A1.5 1.5 0 0012 4.5c-2.5 0-3.5 1-4.5 2.5l-2 2.5a2 2 0 01-2 1V18a2 2 0 002 2h5V14H6" /></svg>
                          <span>{{ helpfulText() }}</span>
                        </li>
                      }
                    </ul>
                  }
                </section>
              </div>

              <!-- RIGHT: Tabs + Feed -->
              <div class="lg:col-span-8 min-w-0">
                <!-- Tab bar with active underline -->
                <div class="flex items-center gap-6 border-b border-gray-200">
                  @for (tab of tabs; track tab.key) {
                    <button
                      (click)="activeTab.set(tab.key)"
                      class="relative pb-3 -mb-px text-sm font-semibold transition-colors focus:outline-none flex items-center gap-2"
                      [ngClass]="activeTab() === tab.key ? 'text-gray-900 border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'"
                    >
                      <span>{{ tab.label | translate }}</span>
                      <span class="text-xs font-bold" [ngClass]="activeTab() === tab.key ? 'text-primary' : 'text-gray-400'">{{ tabCount(tab.key) }}</span>
                    </button>
                  }
                </div>

                <!-- Feed -->
                @if (tabContent().length === 0) {
                  <div class="text-center py-20 bg-white rounded-2xl border border-gray-200/70 mt-5">
                    <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="mt-4 text-gray-400">{{ activeTab() === 'trips' ? ('COMMUNITY.PROFILE.TRIPS_EMPTY' | translate) : (activeTab() === 'photos' ? ('COMMUNITY.PROFILE.PHOTOS_EMPTY' | translate) : ('COMMUNITY.PROFILE.NO_POSTS' | translate)) }}</p>
                  </div>
                } @else {
                  @if (activeTab() === 'photos') {
                  <div class="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    @for (post of tabContent(); track post.id) {
                    <a [routerLink]="['/community/posts', post.id]" class="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 block">
                      <img [src]="postCoverImage(post)" [alt]="postTitle(post)" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                        <span class="text-[11px] font-semibold text-white line-clamp-1">{{ postLocation(post) || postTitle(post) }}</span>
                      </div>
                    </a>
                    }
                  </div>
                  } @else {
                  <div class="space-y-4 mt-5">
                    @for (post of tabContent(); track post.id) {
                      <article class="bg-white rounded-[28px] border border-gray-200 shadow-sm p-6">
                        <div class="flex items-start justify-between">
                        <div class="flex items-start gap-3">
                          <span
                            class="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em]"
                            [ngClass]="postBadge(post) === 'itinerary' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[#FFF8E7] text-[#C77700] border border-[#F2D38B]'"
                          >
                            {{ (postBadge(post) === 'itinerary' ? 'COMMUNITY.PROFILE.BADGE_ITINERARY' : 'COMMUNITY.PROFILE.BADGE_INSIGHT') | translate }}
                          </span>
                          <button type="button" class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors" [attr.aria-label]="'COMMUNITY.PROFILE.MORE_OPTIONS' | translate">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 10a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z" /></svg>
                          </button>
                        </div>
                      </div>

                        @if (postLocation(post)) {
                          <p class="flex items-center gap-1 text-xs text-gray-400 mt-3">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {{ postLocation(post) }}
                          </p>
                        }

                        <a [routerLink]="['/community/posts', post.id]" class="block mt-1 text-base font-semibold text-gray-900 hover:text-primary transition-colors">{{ postTitle(post) }}</a>
                        @if (postDescription(post)) {
                          <p class="mt-1 text-sm text-gray-500 leading-relaxed line-clamp-2 whitespace-pre-line">{{ postDescription(post) }}</p>
                        }
                      </article>
                    }
                  </div>
                  }
                }
              </div>
            </div>

          } @else {
            <div class="text-center py-20">
              <p class="text-gray-500 text-lg">{{ 'COMMUNITY.PROFILE.USER_NOT_FOUND' | translate }}</p>
            </div>
          }

        </div>
      </main>

     

      <!-- ============ EDIT PROFILE MODAL ============ -->
      @if (showEditModal) {
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" (click)="closeEditModal()">
          <div role="dialog" aria-modal="true" [attr.aria-labelledby]="'editProfileTitle'" class="w-full max-w-[560px] rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()">

            <!-- Header -->
            <div class="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h2 id="editProfileTitle" class="text-[28px] sm:text-[32px] leading-[1.15] font-bold text-gray-900 tracking-tight">{{ 'COMMUNITY.PROFILE.EDIT_TITLE' | translate }}</h2>
                <p class="text-sm text-gray-500 mt-2">{{ 'COMMUNITY.PROFILE.EDIT_SUBTITLE' | translate }}</p>
              </div>
              <button (click)="closeEditModal()" class="shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30" [attr.aria-label]="'COMMUNITY.PROFILE.CANCEL' | translate">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Scrollable body -->
            <div class="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">

              <!-- 1. Profile Photo -->
              <div class="flex items-center justify-between gap-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-900">{{ 'COMMUNITY.PROFILE.PHOTO_LABEL' | translate }}</p>
                  <p class="text-xs text-gray-500 mt-1">{{ 'COMMUNITY.PROFILE.PHOTO_HELPER' | translate }}</p>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <img [src]="editForm.avatar || profile()?.avatar || '/assets/images/default-avatar.svg'" [alt]="'COMMUNITY.PROFILE.AVATAR_ALT' | translate" class="w-12 h-12 rounded-full object-cover border border-gray-200 bg-gray-100" />
                  <label class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                    {{ 'COMMUNITY.PROFILE.CHANGE' | translate }}
                    <input type="file" class="hidden" [attr.aria-label]="'COMMUNITY.PROFILE.AVATAR_UPLOAD_ARIA_LABEL' | translate" accept="image/jpeg,image/png,image/webp" (change)="onEditAvatarSelected($event)" [disabled]="editAvatarUploading()" />
                  </label>
                </div>
              </div>
              @if (editAvatarUploading()) {
                <span class="inline-flex items-center gap-2 text-xs font-medium text-gray-500 mt-1.5">
                  <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  {{ 'COMMUNITY.PROFILE.SAVING' | translate }}
                </span>
              }

              <!-- 2. Display Name -->
              <div>
                <label for="edit-display-name" class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{{ 'COMMUNITY.PROFILE.DISPLAY_NAME' | translate }}</label>
                <input id="edit-display-name" [(ngModel)]="editForm.name" (input)="resetNameError()" [class]="'w-full border rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors ' + (editFormErrors.name ? 'border-red-400 focus:ring-red-300' : 'border-gray-300')" />
                @if (editFormErrors.name) {
                  <p class="text-xs text-red-500 mt-1.5" role="alert">{{ editFormErrors.name }}</p>
                }
              </div>

              <!-- 3. About You -->
              <div>
                <label for="edit-about-you" class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{{ 'COMMUNITY.PROFILE.ABOUT_YOU' | translate }}</label>
                <textarea id="edit-about-you" [(ngModel)]="editForm.about" rows="3" maxlength="180" class="w-full border border-gray-300 rounded-xl px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"></textarea>
                <p class="text-xs text-gray-400 mt-1.5 tabular-nums text-right">{{ 'COMMUNITY.PROFILE.ABOUT_COUNTER' | translate: { count: editForm.about.length } }}</p>
              </div>

              <!-- 4. Interests -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{{ 'COMMUNITY.PROFILE.INTERESTS' | translate }}</label>

                <!-- Chips -->
                <div class="flex flex-wrap gap-2 min-h-[2rem]">
                  @for (interest of editForm.interests; track $index) {
                    <span class="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full border border-blue-500 bg-white text-sm font-medium text-gray-800">
                      {{ interest }}
                      <button type="button" (click)="removeInterest(interest)" [attr.aria-label]="('COMMUNITY.PROFILE.REMOVE_INTEREST' | translate) + ': ' + interest" class="flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  }
                </div>

                <!-- Input -->
                <div class="relative mt-2.5">
                  <input
                    [(ngModel)]="interestQuery"
                    (input)="onInterestQuery()"
                    (keydown.enter)="addInterestFromQuery($event)"
                    [disabled]="interestsAtMax"
                    [attr.aria-label]="'COMMUNITY.PROFILE.INTERESTS' | translate"
                    [placeholder]="'COMMUNITY.PROFILE.INTERESTS_MAX' | translate"
                    class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  />
                  @if (interestSuggestions().length > 0) {
                    <div class="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
                      @for (s of interestSuggestions(); track $index) {
                        <button type="button" (click)="addInterest(s)" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">{{ s }}</button>
                      }
                      @if (interestQuery.trim() && !interestSuggestions().some(x => x.toLowerCase() === interestQuery.trim().toLowerCase())) {
                        <button type="button" (click)="addInterestFromQuery()" class="w-full text-left px-4 py-2.5 text-sm text-primary font-medium hover:bg-primary-50">
                          + {{ interestQuery.trim() }}
                        </button>
                      }
                    </div>
                  }
                </div>

                <p class="text-xs text-gray-400 mt-2">{{ 'COMMUNITY.PROFILE.INTERESTS_HELPER' | translate }}</p>
              </div>

              <!-- 5. Privacy -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2.5">{{ 'COMMUNITY.PROFILE.POST_VISIBILITY' | translate }}</label>
                <div class="flex flex-wrap gap-2.5" role="group" [attr.aria-label]="'COMMUNITY.PROFILE.POST_VISIBILITY' | translate">
                  <button
                    type="button"
                    (click)="editForm.post_visibility = 'everyone'"
                    [attr.aria-pressed]="editForm.post_visibility === 'everyone'"
                    [class]="'inline-flex items-center justify-start gap-1.5 h-10 px-5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ' + (editForm.post_visibility === 'everyone' ? 'border-primary bg-white text-primary font-semibold shadow-sm' : 'border-gray-300 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-400')"
                  >
                    @if (editForm.post_visibility === 'everyone') {
                      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    }
                    {{ 'COMMUNITY.PROFILE.VISIBILITY_EVERYONE' | translate }}
                  </button>
                  <button
                    type="button"
                    (click)="editForm.post_visibility = 'followers'"
                    [attr.aria-pressed]="editForm.post_visibility === 'followers'"
                    [class]="'inline-flex items-center justify-start gap-1.5 h-10 px-5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ' + (editForm.post_visibility === 'followers' ? 'border-primary bg-white text-primary font-semibold shadow-sm' : 'border-gray-300 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-400')"
                  >
                    @if (editForm.post_visibility === 'followers') {
                      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    }
                    {{ 'COMMUNITY.PROFILE.VISIBILITY_FOLLOWERS' | translate }}
                  </button>
                </div>
                <p class="text-xs text-gray-400 mt-2.5">{{ 'COMMUNITY.PROFILE.VISIBILITY_HELPER' | translate }}</p>
              </div>
            </div>

            <!-- Footer -->
             <div class="flex items-center justify-between gap-3 px-6 sm:px-8 py-5 border-t border-gray-100">
              <span class="text-xs text-gray-400 font-medium">{{ 'COMMUNITY.PROFILE.INTERESTS_FOOTER_COUNTER' | translate }}</span>
              <div class="flex items-center gap-3 shrink-0">
                <button (click)="closeEditModal()" class="px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">{{ 'COMMUNITY.PROFILE.CANCEL' | translate }}</button>
                <button
                  (click)="saveProfile()"
                  [disabled]="saving()"
                  class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  @if (saving()) {
                    <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    {{ 'COMMUNITY.PROFILE.SAVING' | translate }}
                  } @else {
                    {{ 'COMMUNITY.PROFILE.SAVE_CHANGES' | translate }}
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      } 

      <!-- ============ FOLLOWERS / FOLLOWING MODAL ============ -->
      @if (followersModalOpen()) {
        <app-community-followers-modal
          [mode]="followersModalMode()"
          [open]="true"
          [ownerId]="profile()?.customer_id || customerId"
          [ownerName]="profile()?.name || ''"
          [ownerCount]="followersModalMode() === 'following' ? (profile()?.following_count ?? 0) : (profile()?.followers_count ?? 0)"
          (close)="closeFollowersModal()"
        />
      }
    </div>
  `
})
export class CommunityProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly profileService = inject(CommunityProfileService);

  showEditModal = false;
  readonly followersModalOpen = signal(false);
  readonly followersModalMode = signal<FollowersModalMode>('followers');
  readonly uploadingAvatar = signal(false);
  readonly editAvatarUploading = signal(false);
  readonly saving = signal(false);
  readonly loading = signal(true);
  readonly profile = signal<UserProfile | null>(null);
  readonly posts = signal<any[]>([]);
  readonly togglingFollow = signal(false);
  readonly activeTab = signal<ProfileTab>('posts');

  readonly tabs: { key: ProfileTab; label: string }[] = [
    { key: 'posts', label: 'COMMUNITY.PROFILE.POSTS_TAB' },
    { key: 'trips', label: 'COMMUNITY.PROFILE.TRIPS_TAB' },
    { key: 'photos', label: 'COMMUNITY.PROFILE.PHOTOS_TAB' },
  ];

  customerId = '';

  editForm = {
    name: '',
    about: '',
    local_in: '',
    countries_visited: 0,
    avatar: '',
    interests: [] as string[],
    post_visibility: 'everyone' as string,
  };

  editFormErrors: { name?: string } = {};

  interestQuery = '';
  readonly interestSuggestions = signal<string[]>([]);

  readonly MAX_INTERESTS = 4;

  private readonly INTEREST_PRESETS = [
    'Photography', 'Budget', 'Slow Travel', 'Nightlife', 'Nature',
    'Food', 'Hiking', 'Beaches', 'Culture', 'Adventure',
  ];

  get interestsAtMax(): boolean {
    return this.editForm.interests.length >= this.MAX_INTERESTS;
  }

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.customerId = params.get('id') || '';
      this.loadUser();
    });
  }

  isSelf(): boolean {
    if (!this.auth.isLoggedIn()) return false;
    return this.auth.user()?.id === this.customerId;
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/community']);
    }
  }

  openFollowersModal(mode: FollowersModalMode) {
    this.followersModalMode.set(mode);
    this.followersModalOpen.set(true);
  }

  closeFollowersModal() {
    this.followersModalOpen.set(false);
  }

  interests(): string[] {
    return (this.profile()?.interests ?? []).filter(Boolean);
  }

  mutualConnections(): { id: string; name: string; avatar: string | null }[] {
    return this.profile()?.mutual_connections ?? [];
  }

  sharedDestinations(): string[] {
    return this.profile()?.shared_destinations ?? [];
  }

  commonCount(): number {
    const p = this.profile();
    if (!p) return 0;
    return (p.mutual_connections_count ?? 0) + (p.overlapping_dates ?? 0) + (p.shared_circles ?? 0) + (p.helpful_count ?? 0);
  }

  tabContent(): any[] {
    const all = this.posts();
    switch (this.activeTab()) {
      case 'trips':
        return all.filter(p => p.type === 'trip' || p.type === 'tripPlan' || !!p.itinerary);
      case 'photos':
        return all.filter(p => (p.images?.length || 0) > 0);
      default:
        return all;
    }
  }

  tabCount(tab: ProfileTab): number {
    const all = this.posts();
    switch (tab) {
      case 'trips':
        return all.filter(p => p.type === 'trip' || p.type === 'tripPlan' || !!p.itinerary).length;
      case 'photos':
        return all.filter(p => (p.images?.length || 0) > 0).length;
      default:
        return all.length;
    }
  }

  postCoverImage(post: any): string {
    if (post.images?.length) return post.images[0];
    if (post.videos?.length) return post.videos[0].thumbnail;
    if (post.video_url) return post.video_url;
    if (post.itinerary?.image) return post.itinerary.image;
    return '/assets/images/placeholder.svg';
  }

  profileSubtitle(): string {
    const p = this.profile();
    if (!p) return '';
    if (p.bio) return p.bio;
    if (p.local_in) return p.local_in;
    if ((p.trips_count ?? 0) > 0) {
      return this.translate.instant('COMMUNITY.PROFILE.SUBTITLE_TRIPS', { count: p.trips_count });
    }
    return '';
  }

  isItineraryPost(post: any): boolean {
    return !!post.itinerary || post.type === 'trip' || post.type === 'tripPlan';
  }

  postBadge(post: any): 'itinerary' | 'insight' {
    return this.isItineraryPost(post) ? 'itinerary' : 'insight';
  }

  postLocation(post: any): string {
    return post?.location || post?.destination?.name || post?.itinerary?.destination || '';
  }

  postTitle(post: any): string {
    const itTitle = post?.itinerary?.title?.trim();
    if (itTitle) return itTitle;
    const caption = (post?.caption || '').trim();
    const firstLine = caption.split('\n')[0]?.trim() || '';
    return firstLine || '';
  }

  postDescription(post: any): string {
    return (post?.caption || '').trim();
  }

  mutualFollowText(): string {
    const p = this.profile();
    if (!p || (p.mutual_connections_count ?? 0) <= 0) return '';
    const names = (p.mutual_connections ?? []).map(m => (m.name || '').trim()).filter(Boolean);
    const shown = names.slice(0, 2);
    const count = p.mutual_connections_count ?? 0;
    if (shown.length >= 2 && count > 2) {
      return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_FOLLOWS', { names: shown.join(', '), count: count - 2 });
    }
    if (shown.length === 2) {
      return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_FOLLOW_PAIR', { a: shown[0], b: shown[1] });
    }
    if (shown.length === 1) {
      if (count === 1) return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_FOLLOW_SINGLE', { name: shown[0] });
      return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_FOLLOWS_ONE', { name: shown[0], count: count - 1 });
    }
    return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_FOLLOWS', { names: this.translate.instant('COMMUNITY.PROFILE.MEMBERS'), count });
  }

  overlapText(): string {
    const p = this.profile();
    if (!p || (p.overlapping_dates ?? 0) <= 0) return '';
    const place = (p.shared_destinations ?? [])[0] || p.local_in || '';
    if (place) {
      return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_OVERLAP', { place });
    }
    return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_OVERLAP_COUNT', { count: p.overlapping_dates });
  }

  circlesText(): string {
    const p = this.profile();
    if (!p || (p.shared_circles ?? 0) <= 0) return '';
    return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_CIRCLES', { count: p.shared_circles });
  }

  helpfulText(): string {
    const p = this.profile();
    if (!p || (p.helpful_count ?? 0) <= 0) return '';
    return this.translate.instant('COMMUNITY.PROFILE.IN_COMMON_HELPFUL', { count: p.helpful_count });
  }

  openEditModal() {
    const p = this.profile();
    if (!p) return;
    this.editForm = {
      name: p.name ?? '',
      about: p.about ?? p.bio ?? '',
      local_in: p.local_in ?? '',
      countries_visited: p.countries_visited ?? 0,
      avatar: p.avatar ?? '',
      interests: [...(p.interests ?? [])],
      post_visibility: p.post_visibility ?? 'everyone',
    };
    this.editFormErrors = {};
    this.interestQuery = '';
    this.interestSuggestions.set([]);
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
  }

  resetNameError() {
    this.editFormErrors = {};
  }

  onCountriesVisitedChange(value: any) {
    this.editForm.countries_visited = Number(value) || 0;
  }

  onEditAvatarSelected(event: any) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.editForm.avatar = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onInterestQuery() {
    if (this.interestsAtMax) {
      this.interestSuggestions.set([]);
      return;
    }
    const q = (this.interestQuery || '').trim().toLowerCase();
    const existing = new Set(this.editForm.interests.map(i => i.toLowerCase()));
    if (!q) {
      this.interestSuggestions.set([]);
      return;
    }
    const matches = this.INTEREST_PRESETS.filter(
      i => i.toLowerCase().includes(q) && !existing.has(i.toLowerCase())
    );
    this.interestSuggestions.set(matches);
  }

  addInterest(interest: string) {
    const value = (interest || '').trim();
    if (!value) return;
    if (this.interestsAtMax) {
      this.toast.info(this.translate.instant('COMMUNITY.PROFILE.INTERESTS_MAX'));
      return;
    }
    if (this.editForm.interests.some(i => i.toLowerCase() === value.toLowerCase())) {
      this.toast.info(this.translate.instant('COMMUNITY.PROFILE.INTEREST_DUPLICATE'));
      return;
    }
    this.editForm.interests = [...this.editForm.interests, value];
    this.interestQuery = '';
    this.interestSuggestions.set([]);
  }

  addInterestFromQuery(event?: any) {
    if (event) event.preventDefault();
    this.addInterest(this.interestQuery);
  }

  removeInterest(interest: string) {
    this.editForm.interests = this.editForm.interests.filter(i => i !== interest);
  }

  saveProfile() {
    if (!this.editForm.name.trim()) {
      this.editFormErrors.name = this.translate.instant('COMMUNITY.PROFILE.NAME_REQUIRED');
      return;
    }

    this.saving.set(true);
    const updates: {
      name?: string;
      bio?: string;
      avatar?: string;
      local_in?: string;
      cover?: string;
      about?: string;
      interests?: string[];
      countries_visited?: number;
      post_visibility?: string;
    } = {
      name: this.editForm.name.trim(),
      about: this.editForm.about,
      interests: [...this.editForm.interests],
      local_in: this.editForm.local_in,
      countries_visited: Number(this.editForm.countries_visited) || 0,
      avatar: this.editForm.avatar,
      post_visibility: this.editForm.post_visibility === 'followers' ? 'followers' : 'everyone',
    };
    this.profileService
      .updateProfile(updates)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.profile.update(p => (p ? { ...p, ...updated } : p));
          this.showEditModal = false;
          this.toast.success(this.translate.instant('COMMUNITY.PROFILE.TOAST_PROFILE_UPDATED'));
        },
        error: () => {
          this.toast.error(this.translate.instant('COMMUNITY.PROFILE.TOAST_PROFILE_FAILED'));
        },
      });
  }

  onAvatarSelected(event: any) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    this.uploadingAvatar.set(true);
    this.profileService
      .uploadImage(file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(res => this.profileService.updateProfile({ avatar: res.url })),
        finalize(() => this.uploadingAvatar.set(false)),
      )
      .subscribe({
        next: (updated) => {
          this.profile.update(p => (p ? { ...p, ...updated } : p));
          this.toast.success(this.translate.instant('COMMUNITY.PROFILE.TOAST_AVATAR_UPDATED'));
        },
        error: () => {
          this.toast.error(this.translate.instant('COMMUNITY.PROFILE.TOAST_AVATAR_FAILED'));
        },
      });
  }

  private loadUser() {
    const id = this.customerId.trim();
    if (!id) {
      this.profile.set(null);
      this.posts.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.profile.set(null);
    this.posts.set([]);

    forkJoin({
      profile: this.profileService.getUserProfile(id).pipe(catchError(() => of(null))),
      posts: this.profileService.getUserPosts(id).pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe(({ profile, posts }) => {
        this.profile.set(profile && profile.customer_id ? profile : null);
        this.posts.set(posts ?? []);
      });
  }

  toggleFollow(): void {
    const p = this.profile();
    if (!p || this.togglingFollow()) return;

    if (!this.auth.isLoggedIn()) {
      this.toast.info(this.translate.instant('COMMUNITY.PROFILE.LOGIN_TO_FOLLOW'));
      return;
    }

    const wasFollowing = p.is_following;
    this.togglingFollow.set(true);
    this.applyFollowState(!wasFollowing);

    this.profileService.toggleFollow(p.customer_id)
      .pipe(finalize(() => this.togglingFollow.set(false)))
      .subscribe({
        next: (res) => {
          this.applyFollowState(res.is_following);
          const toastKey = res.is_following
            ? 'COMMUNITY.PROFILE.TOAST_FOLLOWED'
            : 'COMMUNITY.PROFILE.TOAST_UNFOLLOWED';
          this.toast.success(this.translate.instant(toastKey, { name: p.name }));
        },
        error: (err) => {
          this.applyFollowState(wasFollowing);
          const message = err?.status === 401
            ? this.translate.instant('COMMUNITY.PROFILE.LOGIN_TO_FOLLOW')
            : this.translate.instant('COMMUNITY.PROFILE.TOAST_FOLLOW_FAILED');
          this.toast.error(message);
        },
      });
  }

  private applyFollowState(isFollowing: boolean): void {
    const p = this.profile();
    if (!p) return;
    const delta = isFollowing === p.is_following ? 0 : isFollowing ? 1 : -1;
    this.profile.set({
      ...p,
      is_following: isFollowing,
      followers_count: Math.max(0, p.followers_count + delta),
      mutual_connections_count: Math.max(0, (p.mutual_connections_count ?? 0) + delta),
    });
  }
}
