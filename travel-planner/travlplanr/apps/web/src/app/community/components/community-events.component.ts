import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityEventsService, CommunityEvent } from '../services/community-events.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-community-events',
    imports: [CommonModule, RouterLink, TranslatePipe, FormsModule],
    template: `
    <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <!-- Header -->
      <div class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-text-primary dark:text-white mb-1">📅 Community Events & Meetups</h1>
          <p class="text-text-secondary dark:text-gray-300 text-sm">Join meetups organized by other travelers.</p>
        </div>
      </div>
    
      <!-- Action Banner -->
      <div class="mb-6 flex justify-between items-center bg-indigo-50/50 dark:bg-gray-800/50 border border-primary-subtle/30 dark:border-gray-700/50 p-4 rounded-2xl shadow-inner gap-4">
        <p class="text-xs text-text-secondary dark:text-gray-300">Are you hosting a meetup? Share it with the community!</p>
        <button
          (click)="showCreateModal.set(true)"
          class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0"
          >
          Create Meetup
        </button>
      </div>
    
      <!-- Loading skeleton -->
      @if (isLoading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (i of [1, 2, 3]; track i) {
            <div class="bg-white/80 rounded-2xl border border-slate-100 p-5 animate-pulse h-56">
              <div class="h-28 bg-slate-200 rounded-xl mb-3"></div>
              <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          }
        </div>
      } @else if (loadError()) {
        <div class="bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <span class="text-3xl mb-3 block">⚠️</span>
          <h3 class="font-extrabold text-base text-text-primary mb-1">Couldn't load meetups</h3>
          <p class="text-text-secondary text-xs mb-4">Something went wrong while fetching events.</p>
          <button (click)="loadEvents()" class="px-4 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all">
            Retry
          </button>
        </div>
      } @else {
        <!-- Events grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (ev of events(); track ev.id) {
            <div class="bg-white/80 dark:bg-gray-800/90 border border-slate-100 dark:border-gray-700/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col group relative">
    
              <!-- Cover image / visual card top -->
              <div class="h-32 bg-gradient-to-tr from-slate-900 to-indigo-950 flex items-center justify-center relative overflow-hidden select-none">
                @if (ev.image_url) {
                  <img [src]="ev.image_url" class="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500" />
                }
                <span class="text-3xl relative z-10">🍻</span>
              </div>
    
              <!-- Card body -->
              <div class="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span class="text-[9px] font-extrabold text-primary uppercase tracking-wide block mb-1">
                    {{ formatDate(ev.starts_at) }}
                  </span>
                  <h3 class="font-extrabold text-sm text-text-primary dark:text-white leading-snug mb-1.5 group-hover:text-primary transition-colors">
                    <a [routerLink]="['/community/events', ev.id]">{{ ev.title }}</a>
                  </h3>
                  <p class="text-2xs text-text-tertiary dark:text-gray-400 font-bold mb-3 flex items-center gap-1">
                    @if (ev.location) {
                      <span>📍 {{ ev.location }}</span>
                      <span>•</span>
                    }
                    <span>👥 {{ ev.attendee_count }} going</span>
                  </p>
                  <p class="text-xs text-text-secondary dark:text-gray-300 line-clamp-2 leading-relaxed mb-4">
                    {{ ev.description }}
                  </p>
                </div>
    
                <div class="border-t border-slate-100 dark:border-gray-700/50 pt-3.5 mt-auto flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img [src]="ev.organizer.avatar || '/assets/images/default-avatar.svg'" class="w-7 h-7 rounded-full object-cover border shrink-0 bg-slate-50" />
                    <span class="text-2xs font-extrabold text-text-secondary dark:text-gray-300 truncate max-w-[100px]">{{ ev.organizer.name }}</span>
                  </div>
    
                  <button
                    (click)="toggleRsvp(ev)"
                    class="px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-102 focus:outline-none"
                    [class.bg-slate-100]="ev.rsvp_status === 'going'"
                    [class.text-text-secondary]="ev.rsvp_status === 'going'"
                    [class.bg-primary]="ev.rsvp_status !== 'going'"
                    [class.text-white]="ev.rsvp_status !== 'going'"
                    [ngClass]="{
                      'dark:bg-gray-700': ev.rsvp_status === 'going',
                      'dark:text-gray-300': ev.rsvp_status === 'going',
                      'hover:bg-primary-hover': ev.rsvp_status !== 'going'
                    }"
                    >
                    {{ ev.rsvp_status === 'going' ? 'Going' : 'RSVP' }}
                  </button>
                </div>
              </div>
            </div>
          }
          @if (events().length === 0) {
            <div class="col-span-full bg-white/80 border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
              <span class="text-3xl mb-3 block">📅</span>
              <h3 class="font-extrabold text-base text-text-primary mb-1">No Events Found</h3>
              <p class="text-text-secondary text-xs">There are no upcoming meetups right now.</p>
            </div>
          }
        </div>
      }
    
      <!-- Create Event Modal -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl border border-slate-100 dark:border-gray-700 animate-fade-in-up">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3 mb-4">
              <h3 class="font-extrabold text-base text-text-primary dark:text-white flex items-center gap-2">
                <span>📅</span> Create Meetup
              </h3>
              <button (click)="showCreateModal.set(false)" class="text-text-tertiary hover:text-text-primary dark:hover:text-white text-lg focus:outline-none">&times;</button>
            </div>
    
            <!-- Form -->
            <div class="space-y-4">
              <div>
                <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Meetup Title</label>
                <input
                  type="text"
                  [(ngModel)]="newEventTitle"
                  placeholder="e.g. Kyoto Food Crawl"
                  class="w-full text-xs px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white font-medium"
                  />
              </div>
    
              <div>
                <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Description</label>
                <textarea
                  [(ngModel)]="newEventDesc"
                  rows="3"
                  placeholder="What will you do? Where will you meet?"
                  class="w-full text-xs p-3 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white resize-none"
                ></textarea>
              </div>
    
              <div>
                <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Location</label>
                <input
                  type="text"
                  [(ngModel)]="newEventLocation"
                  placeholder="e.g. Kyoto, Japan"
                  class="w-full text-xs px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white font-medium"
                  />
              </div>
              <div>
                <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">Date & Time</label>
                <input
                  type="datetime-local"
                  [(ngModel)]="newEventDate"
                  class="w-full text-xs px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white font-medium"
                  />
              </div>
              @if (createError()) {
                <p class="text-2xs font-bold text-red-500">{{ createError() }}</p>
              }
            </div>
    
            <!-- Footer actions -->
            <div class="mt-6 flex justify-end gap-2 border-t border-slate-100 dark:border-gray-700 pt-4">
              <button
                (click)="showCreateModal.set(false)"
                class="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                >
                Cancel
              </button>
              <button
                (click)="submitCreateEvent()"
                [disabled]="!newEventTitle || !newEventDesc || !newEventLocation || !newEventDate"
                class="px-5 py-2 text-xs bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
                >
                Create Meetup
              </button>
            </div>
          </div>
        </div>
      }
    </div>
    `
})
export class CommunityEventsComponent implements OnInit {
  private eventsService = inject(CommunityEventsService);

  events = signal<CommunityEvent[]>([]);
  isLoading = signal(true);
  loadError = signal(false);

  // Create Form State
  showCreateModal = signal(false);
  createError = signal<string | null>(null);
  newEventTitle = '';
  newEventDesc = '';
  newEventLocation = '';
  newEventDate = '';

  ngOnInit() {
    this.loadEvents();
  }

  loadEvents() {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.eventsService.getEvents().subscribe({
      next: (data) => {
        this.events.set(data.meetups);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set(true);
      }
    });
  }

  /**
   * Posting the same status the caller already has toggles it off
   * (un-RSVP); the backend upserts otherwise. Re-fetch afterwards to get
   * an authoritative attendee_count rather than guessing at the delta.
   */
  toggleRsvp(ev: CommunityEvent) {
    this.eventsService.setRsvp(ev.id, 'going').subscribe(() => {
      this.eventsService.getEvent(ev.id).subscribe(fresh => Object.assign(ev, fresh));
    });
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  submitCreateEvent() {
    if (!this.newEventTitle.trim() || !this.newEventDesc.trim() || !this.newEventLocation.trim() || !this.newEventDate) return;
    this.createError.set(null);

    this.eventsService.createEvent({
      title: this.newEventTitle.trim(),
      description: this.newEventDesc.trim(),
      location: this.newEventLocation.trim(),
      starts_at: new Date(this.newEventDate).toISOString()
    }).subscribe({
      next: () => {
        this.showCreateModal.set(false);
        this.loadEvents();
        // Reset Form
        this.newEventTitle = '';
        this.newEventDesc = '';
        this.newEventLocation = '';
        this.newEventDate = '';
      },
      error: () => {
        this.createError.set("Couldn't create meetup. Please check the details and try again.");
      }
    });
  }
}
