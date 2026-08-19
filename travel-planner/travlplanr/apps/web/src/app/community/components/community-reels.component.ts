import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityPostService, CommunityPost } from '../services/community-post.service';
import { CommunityProfileService } from '../services/community-profile.service';

@Component({
    selector: 'app-community-reels',
    imports: [RouterLink, TranslatePipe],
    template: `
    <div class="h-screen w-full bg-black flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar">
        @if (isLoading()) {
          <div class="h-full w-full flex items-center justify-center text-white">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        }
        
        @for (post of reels(); track post.id) {
          <div class="h-full w-full snap-start relative flex items-center justify-center bg-zinc-900 border-b border-zinc-800">
            @if (post.video_url) {
              <video 
                [src]="post.video_url" 
                [attr.data-post-id]="post.id"
                class="w-full h-full object-cover cursor-pointer" 
                loop 
                [muted]="isMuted()" 
                playsinline
                preload="none"
                (playing)="onVideoPlay(post.id)"
                (play)="onVideoPlaying(post.id)"
                (pause)="onVideoPause(post.id)"
                (click)="togglePlayById(post.id)"
              ></video>
            } @else {
              <!-- Fallback to image if marked as reel but no video URL -->
              <img [src]="post.images[0] || '/assets/images/default-avatar.svg'" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            }
            
            @if (pausedVideos()[post.id]) {
              <div (click)="togglePlayById(post.id)" class="absolute inset-0 flex items-center justify-center bg-black/20 z-10 cursor-pointer">
                <div class="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center text-white scale-100 hover:scale-110 active:scale-95 transition-transform">
                  <svg class="w-8 h-8 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
            }
            
            <!-- Overlay UI -->
            <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
              <div class="flex justify-between items-end">
                <div class="text-white max-w-[80%]">
                  <div class="flex items-center gap-3 mb-3">
                    <img [src]="post.author.avatar || '/assets/images/default-avatar.svg'" class="w-10 h-10 rounded-full border border-white/20" loading="lazy" decoding="async" />
                    <span class="font-bold text-base">{{ post.author.name }}</span>
                    <button (click)="toggleFollow(post)" [attr.aria-label]="(post.is_following ? 'COMMUNITY.REELS.FOLLOWING' : 'COMMUNITY.REELS.FOLLOW') | translate" class="px-3 py-1 text-xs font-bold border rounded-full hover:bg-white hover:text-black transition-colors" [class.border-white]="!post.is_following" [class.bg-white]="post.is_following" [class.text-black]="post.is_following" [class.border-transparent]="post.is_following">{{ (post.is_following ? 'COMMUNITY.REELS.FOLLOWING' : 'COMMUNITY.REELS.FOLLOW') | translate }}</button>
                  </div>
                  <p class="text-sm line-clamp-2">{{ post.caption }}</p>
                </div>
                
                <div class="flex flex-col items-center gap-6 pb-2">
                  <button (click)="toggleLike(post)" [attr.aria-label]="(post.isLiked ? 'COMMUNITY.REELS.UNLIKE' : 'COMMUNITY.REELS.LIKE') | translate" class="flex flex-col items-center gap-1 transition-colors" [class.text-red-500]="post.isLiked" [class.text-white]="!post.isLiked">
                    <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                      <svg class="w-6 h-6" [attr.fill]="post.isLiked ? 'currentColor' : 'none'" [attr.stroke]="post.isLiked ? 'none' : 'currentColor'" stroke-width="2" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </div>
                    <span class="text-xs font-bold">{{ post.likes }}</span>
                  </button>
                  
                  <button [routerLink]="['/community/posts', post.id]" class="flex flex-col items-center gap-1 text-white hover:text-blue-400 transition-colors">
                    <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    </div>
                    <span class="text-xs font-bold">{{ post.comments }}</span>
                  </button>
                  
                  <button (click)="toggleMute()" [attr.aria-label]="(isMuted() ? 'COMMUNITY.REELS.UNMUTE' : 'COMMUNITY.REELS.MUTE') | translate" class="flex flex-col items-center gap-1 text-white hover:text-yellow-400 transition-colors">
                    <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                      @if (isMuted()) {
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V5.25z"/></svg>
                      } @else {
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/></svg>
                      }
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        }

        @if (!isLoading() && reels().length === 0) {
          <div class="h-full w-full flex flex-col items-center justify-center text-white gap-4">
            <svg class="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p class="text-lg font-semibold">{{ 'COMMUNITY.REELS.EMPTY_TITLE' | translate }}</p>
            <p class="text-sm text-gray-400">{{ 'COMMUNITY.REELS.EMPTY_SUBTITLE' | translate }}</p>
          </div>
        }
      </div>
    </div>
  `,
    styles: [`
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class CommunityReelsComponent implements OnInit, OnDestroy {
  private postService = inject(CommunityPostService);
  private profileService = inject(CommunityProfileService);
  
  reels = signal<CommunityPost[]>([]);
  isLoading = signal(true);
  isMuted = signal(true);
  pausedVideos = signal<Record<string, boolean>>({});
  private observer: IntersectionObserver | null = null;
  private videoRefs: HTMLVideoElement[] = [];

  ngOnInit() {
    this.postService.getExploreFeed().subscribe({
      next: (response) => {
        const realReels = response.posts.filter(p => p.is_reel || p.video_url);
        this.reels.set(realReels);
        this.isLoading.set(false);
        if (realReels.length > 0) {
          this.setupIntersectionObserver();
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    // Release and stop all video resources to prevent memory leaks
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.pause();
        v.src = '';
        v.load();
      } catch (e) {}
    });
  }
  
  onVideoPlay(postId: string) {
    // Log a view when the video plays
    this.postService.viewPost(postId).subscribe();
  }

  onVideoPlaying(postId: string): void {
    this.pausedVideos.update((p) => ({ ...p, [postId]: false }));
  }

  onVideoPause(postId: string): void {
    this.pausedVideos.update((p) => ({ ...p, [postId]: true }));
  }

  setupIntersectionObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        // Check if the video is significantly visible and not marked as paused by user
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const postId = video.getAttribute('data-post-id');
          if (postId && !this.pausedVideos()[postId]) {
            video.play().catch(() => {});
          }
        } else {
          video.pause();
        }
      });
    }, {
      threshold: [0, 0.5, 0.6, 1.0],
      // Let it use the default viewport, but require at least 50% intersection
    });

    setTimeout(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach(v => this.observer?.observe(v));
    }, 100);
  }

  togglePlayById(postId: string): void {
    const video = document.querySelector(`video[data-post-id="${postId}"]`) as HTMLVideoElement | null;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      this.pausedVideos.update((p) => ({ ...p, [postId]: false }));
    } else {
      video.pause();
      this.pausedVideos.update((p) => ({ ...p, [postId]: true }));
    }
  }

  toggleMute() {
    this.isMuted.set(!this.isMuted());
  }

  toggleFollow(post: CommunityPost) {
    if (!post.author?.id) return;
    post.is_following = !post.is_following;
    this.profileService.toggleFollow(post.author.id).subscribe({
      next: (res) => { post.is_following = res.is_following; },
      error: () => { post.is_following = !post.is_following; }
    });
  }

  toggleLike(post: CommunityPost) {
    const wasLiked = post.isLiked;
    post.isLiked = !wasLiked;
    post.likes = (post.likes || 0) + (wasLiked ? -1 : 1);
    this.postService.toggleLike(post.id).subscribe({
      next: (res) => { post.likes = res.likes_count; },
      error: () => { post.isLiked = wasLiked; post.likes = (post.likes || 0) + (wasLiked ? 1 : -1); }
    });
  }
}
