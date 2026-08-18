import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FooterSectionComponent } from '../../landing/components/footer-section/footer-section.component';
import { CommunityProfileService, UserProfile } from '../services/community-profile.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/utils/toast.service';

@Component({
    selector: 'app-community-profile',
    imports: [CommonModule, RouterLink, TranslatePipe, FooterSectionComponent],
    template: `
    <div class="min-h-screen bg-neutral-50 flex flex-col">
      <main class="flex-1 flex justify-center py-12 px-4 sm:px-6">
        <div class="w-full max-w-4xl space-y-8">
          
          @if (loading()) {
            <div class="flex justify-center items-center py-20">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          } @else if (profile()) {
            <!-- Profile Header -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col md:flex-row items-center md:items-start gap-8">
              
              <!-- Avatar -->
              <div class="shrink-0 relative group">
                <img [src]="profile()?.avatar || '/assets/images/default-avatar.svg'" [alt]="'COMMUNITY.PROFILE.AVATAR_ALT' | translate" class="w-32 h-32 rounded-full object-cover border-4 border-gray-50 bg-white" />
                @if (isSelf()) {
                  <label class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <input type="file" class="hidden" [attr.aria-label]="'COMMUNITY.PROFILE.AVATAR_UPLOAD_ARIA_LABEL' | translate" accept="image/jpeg,image/png,image/webp" (change)="onAvatarSelected($event)" [disabled]="uploadingAvatar()" />
                  </label>
                  @if (uploadingAvatar()) {
                    <div class="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full">
                      <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  }
                }
              </div>
              
              <!-- Info -->
              <div class="flex-1 flex flex-col items-center md:items-start gap-4">
                <div class="flex flex-col md:flex-row items-center gap-4">
                  <h1 class="text-3xl font-bold text-gray-900">{{ profile()?.name }}</h1>
                  
                  @if (!isSelf()) {
                    <button 
                      (click)="toggleFollow()"
                      [disabled]="togglingFollow()"
                      class="px-6 py-2 rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                      [ngClass]="profile()?.is_following ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-300' : 'bg-primary text-white hover:bg-blue-700 focus:ring-primary'"
                    >
                      {{ (profile()?.is_following ? 'COMMUNITY.PROFILE.FOLLOWING_BUTTON' : 'COMMUNITY.PROFILE.FOLLOW_BUTTON') | translate }}
                    </button>
                  }
                </div>

                <div class="flex gap-6 text-sm">
                  <div class="flex gap-1 items-center">
                    <span class="font-bold text-gray-900">{{ profile()?.posts_count }}</span>
                    <span class="text-gray-600">{{ 'COMMUNITY.PROFILE.POSTS_LABEL' | translate }}</span>
                  </div>
                  <div class="flex gap-1 items-center cursor-pointer hover:underline">
                    <span class="font-bold text-gray-900">{{ profile()?.followers_count }}</span>
                    <span class="text-gray-600">{{ 'COMMUNITY.PROFILE.FOLLOWERS_LABEL' | translate }}</span>
                  </div>
                  <div class="flex gap-1 items-center cursor-pointer hover:underline">
                    <span class="font-bold text-gray-900">{{ profile()?.following_count }}</span>
                    <span class="text-gray-600">{{ 'COMMUNITY.PROFILE.FOLLOWING_LABEL' | translate }}</span>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2 mt-2">
                  @if (profile()?.is_verified) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      {{ 'COMMUNITY.PROFILE.VERIFIED' | translate }}
                    </span>
                  }
                  @if (profile()?.countries_visited) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">
                      🌍 {{ 'COMMUNITY.PROFILE.COUNTRIES_COUNT' | translate: { n: profile()?.countries_visited } }}
                    </span>
                  }
                  @if (profile()?.local_in) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">
                      📍 {{ 'COMMUNITY.PROFILE.LOCAL_IN' | translate: { place: profile()?.local_in } }}
                    </span>
                  }
                </div>
                
                <p class="text-gray-800 max-w-md text-center md:text-left">{{ profile()?.bio }}</p>
              </div>
            </div>

            <!-- Posts Grid -->
            <div>
              <h2 class="text-xl font-bold text-gray-900 mb-6 border-b pb-2">{{ 'COMMUNITY.PROFILE.POSTS_HEADING' | translate }}</h2>

              @if (posts().length === 0) {
                <div class="text-center py-20 bg-white rounded-2xl border border-gray-200">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="mt-4 text-gray-500">{{ 'COMMUNITY.PROFILE.NO_POSTS' | translate }}</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  @for (post of posts(); track post.id) {
                    <a [routerLink]="['/community/posts', post.id]" class="block bg-gray-100 aspect-square rounded-xl overflow-hidden group cursor-pointer relative shadow-sm hover:shadow-md transition-shadow">
                      <img [src]="post.images?.length ? post.images[0] : (post.videos?.length ? post.videos[0].thumbnail : '/assets/images/placeholder.svg')" [alt]="'COMMUNITY.PROFILE.POST_IMAGE_ALT' | translate" class="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" decoding="async" />
                      
                      <!-- Overlay on hover -->
                      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold text-lg">
                        <div class="flex items-center gap-2">
                          <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                          <span>{{ post.likes }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                          <span>{{ post.comments }}</span>
                        </div>
                      </div>
                    </a>
                  }
                </div>
              }
            </div>
            
          } @else {
            <div class="text-center py-20">
              <p class="text-gray-500 text-lg">{{ 'COMMUNITY.PROFILE.USER_NOT_FOUND' | translate }}</p>
            </div>
          }
          
        </div>
      </main>

      <app-footer-section />
    </div>
  `
})
export class CommunityProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly profileService = inject(CommunityProfileService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  showEditModal = false;
  readonly uploadingAvatar = signal(false);
  readonly loading = signal(true);
  readonly profile = signal<UserProfile | null>(null);
  readonly posts = signal<any[]>([]);
  readonly togglingFollow = signal(false);

  customerId = '';

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.customerId = params.get('id') || '';
      if (this.customerId) {
        this.loadUser();
      }
    });
  }

  isSelf(): boolean {
    if (!this.auth.isLoggedIn()) return false;
    return this.auth.user()?.id === this.customerId;
  }

  private closeEditModal() {
    this.showEditModal = false;
  }

  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    
    this.uploadingAvatar.set(true);
    this.profileService.uploadImage(file).subscribe({
      next: (res) => {
        this.profileService.updateProfile({ avatar: res.url }).subscribe({
          next: (updatedProfile) => {
            this.profile.set(updatedProfile);
            this.uploadingAvatar.set(false);
          },
          error: (err) => {
            console.error('Failed to update profile avatar', err);
            this.uploadingAvatar.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Failed to upload image', err);
        this.uploadingAvatar.set(false);
      }
    });
  }

  private loadUser() {
    this.loading.set(true);
    this.profileService.getUserProfile(this.customerId).subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loadPosts();
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private loadPosts() {
    this.profileService.getUserPosts(this.customerId).subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  toggleFollow() {
    if (!this.auth.isLoggedIn()) {
      this.toast.info(this.translate.instant('COMMUNITY.PROFILE.LOGIN_TO_FOLLOW'));
      return;
    }
    
    this.togglingFollow.set(true);
    this.profileService.toggleFollow(this.customerId).subscribe({
      next: (res) => {
        this.profile.update(p => {
          if (!p) return p;
          return {
            ...p,
            is_following: res.is_following,
            followers_count: res.is_following ? p.followers_count + 1 : p.followers_count - 1
          };
        });
        this.togglingFollow.set(false);
      },
      error: () => {
        this.togglingFollow.set(false);
      }
    });
  }
}
