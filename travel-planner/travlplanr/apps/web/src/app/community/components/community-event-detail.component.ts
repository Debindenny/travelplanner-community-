import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityEventsService, CommunityEvent } from '../services/community-events.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-community-event-detail',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <!-- Breadcrumb -->
      <nav class="flex mb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider gap-2">
        <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
        <a routerLink="/community/events" class="hover:text-primary transition-colors">Events</a>
        <span>/</span>
        <span class="text-text-primary">Details</span>
      </nav>
    
      @if (isLoading()) {
        <div class="h-60 bg-slate-100 dark:bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      } @else if (loadError()) {
        <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-extrabold text-base text-text-primary mb-1">Couldn't load this event</h3>
          <p class="text-text-secondary text-xs mb-4">It may have been removed, or something went wrong.</p>
          <button (click)="retry()" class="px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Retry
          </button>
        </div>
      } @else {
        @if (event(); as ev) {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    
            <!-- Event Core details column -->
            <div class="col-span-1 lg:col-span-8 space-y-6">
              <!-- Event Hero Card -->
              <div class="relative rounded-2xl overflow-hidden bg-gradient-to-tr from-slate-900 to-indigo-950 p-6 sm:p-8 text-white min-h-[200px] flex flex-col justify-between select-none">
                @if (ev.image_url) {
                  <img [src]="ev.image_url" class="absolute inset-0 w-full h-full object-cover opacity-35" />
                }
                <div class="absolute top-4 right-4 text-3xl">🍻</div>
    
                <div class="relative z-10">
                  <h1 class="text-2xl sm:text-3xl font-black mt-2 leading-tight">
                    {{ ev.title }}
                  </h1>
                  <p class="text-xs text-white/80 mt-2 flex items-center gap-1.5 flex-wrap">
                    <span>📅 {{ formatDate(ev.starts_at) }}</span>
                    @if (ev.location) {
                      <span>•</span>
                      <span>📍 {{ ev.location }}</span>
                    }
                  </p>
                </div>
    
                <div class="relative z-10 border-t border-white/10 pt-4 mt-6 flex justify-between items-center">
                  <div class="text-xs font-bold text-white/70">
                    👥 {{ ev.attendee_count }} going
                  </div>
                  <button
                    (click)="toggleRsvp(ev)"
                    class="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-105 active:scale-95 shadow-md"
                    [class.border]="ev.rsvp_status === 'going'"
                    [class.text-white]="ev.rsvp_status === 'going'"
                    [class.bg-white]="ev.rsvp_status !== 'going'"
                    [class.text-indigo-950]="ev.rsvp_status !== 'going'"
                  [ngClass]="{
                    'bg-white/10': ev.rsvp_status === 'going',
                    'border-white/20': ev.rsvp_status === 'going',
                    'hover:bg-white/90': ev.rsvp_status !== 'going'
                  }"
                    >
                    {{ ev.rsvp_status === 'going' ? 'Leave Event' : 'Join Event' }}
                  </button>
                </div>
              </div>
    
              <!-- Description -->
              @if (ev.description) {
                <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm">
                  <h3 class="font-extrabold text-sm text-text-primary dark:text-white mb-3">About this Event</h3>
                  <p class="text-xs text-text-secondary dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {{ ev.description }}
                  </p>
                </div>
              }
            </div>
    
            <!-- Sidebar details Column -->
            <div class="col-span-1 lg:col-span-4 space-y-4">
              <!-- Organizer Card -->
              <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl p-4 shadow-sm">
                <h3 class="text-2xs font-extrabold text-text-tertiary uppercase tracking-wider mb-3">Organizer</h3>
                <div class="flex items-center gap-3">
                  <img [src]="ev.organizer.avatar || '/assets/images/default-avatar.svg'" class="w-11 h-11 rounded-full object-cover border bg-slate-50 shrink-0" />
                  <div>
                    <h4 class="font-extrabold text-xs text-text-primary dark:text-white">{{ ev.organizer.name }}</h4>
                    <p class="text-[9px] font-bold text-text-tertiary dark:text-gray-400 mt-0.5">Community Host</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
    `
})
export class CommunityEventDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventsService = inject(CommunityEventsService);

  event = signal<CommunityEvent | null>(null);
  isLoading = signal(true);
  loadError = signal(false);
  private currentId: string | null = null;

  private sub?: Subscription;

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadEvent(id);
      }
    });
  }

  loadEvent(id: string) {
    this.currentId = id;
    this.isLoading.set(true);
    this.loadError.set(false);
    this.eventsService.getEvent(id).subscribe({
      next: (ev) => {
        this.event.set(ev);
        this.isLoading.set(false);
      },
      error: () => {
        this.event.set(null);
        this.isLoading.set(false);
        this.loadError.set(true);
      }
    });
  }

  retry() {
    if (this.currentId) this.loadEvent(this.currentId);
  }

  /**
   * Posting the same status the caller already has toggles it off
   * (un-RSVP); the backend upserts otherwise.
   */
  toggleRsvp(ev: CommunityEvent) {
    this.eventsService.setRsvp(ev.id, 'going').subscribe(() => {
      this.eventsService.getEvent(ev.id).subscribe(fresh => this.event.set(fresh));
    });
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }
}
