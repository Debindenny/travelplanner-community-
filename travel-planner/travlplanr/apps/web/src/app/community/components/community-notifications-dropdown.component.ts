import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityNotificationsService, Notification } from '../services/community-notifications.service';
import { AuthService } from '../../auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-community-notifications-dropdown',
    imports: [CommonModule, RouterLink, TranslatePipe],
    template: `
    <div class="relative">
      <button
        (click)="toggleDropdown()"
        class="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none transition-colors rounded-full hover:bg-gray-100"
        [attr.aria-label]="'COMMUNITY.NOTIFICATIONS.TITLE' | translate"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        @if (unreadCount() > 0) {
          <span class="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-2xs font-bold text-white bg-red-500 rounded-full border-2 border-white">
            {{ unreadCount() > 99 ? '99+' : unreadCount() }}
          </span>
        }
      </button>

      @if (isOpen()) {
        <div class="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 transform origin-top-right transition-all">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 class="font-bold text-gray-900">{{ 'COMMUNITY.NOTIFICATIONS.TITLE' | translate }}</h3>
            @if (unreadCount() > 0) {
              <button
                (click)="markAllAsRead()"
                class="text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
              >
                {{ 'COMMUNITY.NOTIFICATIONS.MARK_ALL_AS_READ' | translate }}
              </button>
            }
          </div>

          <div class="max-h-[400px] overflow-y-auto">
            @if (notifications().length === 0) {
              <div class="px-4 py-8 text-center text-gray-500">
                <svg class="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p>{{ 'COMMUNITY.NOTIFICATIONS.EMPTY' | translate }}</p>
              </div>
            } @else {
              @for (notification of notifications(); track notification.id) {
                <div 
                  (click)="handleNotificationClick(notification)"
                  class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                  [class.bg-blue-50]="!notification.is_read"
                >
                  <!-- Icon based on type -->
                  <div class="shrink-0 mt-1">
                    @if (notification.type === 'like') {
                      <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                      </div>
                    } @else if (notification.type === 'comment') {
                      <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                      </div>
                    } @else if (notification.type === 'follow') {
                      <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-500">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                      </div>
                    } @else {
                      <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      </div>
                    }
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900" [class.font-semibold]="!notification.is_read">{{ notification.message }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">{{ notification.created_at | date:'short' }}</p>
                  </div>
                  
                  @if (!notification.is_read) {
                    <div class="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  }
                </div>
              }
            }
          </div>
          
          <div class="border-t border-gray-100 p-2 text-center bg-gray-50">
            <!-- There is no dedicated "all notifications" list page yet; just close the dropdown for now. -->
            <button
              (click)="closeDropdown()"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {{ 'COMMUNITY.NOTIFICATIONS.VIEW_ALL' | translate }}
            </button>
          </div>
        </div>
      }
    </div>
    
    <!-- Invisible overlay to close dropdown -->
    @if (isOpen()) {
      <div class="fixed inset-0 z-40" (click)="closeDropdown()"></div>
    }
  `
})
export class CommunityNotificationsDropdownComponent implements OnInit, OnDestroy {
  private notificationsService = inject(CommunityNotificationsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  isOpen = signal(false);
  unreadCount = signal(0);
  notifications = signal<Notification[]>([]);
  private wsSubscription: Subscription | null = null;

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.loadUnreadCount();
      this.subscribeToNotifications();
    }
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
  }

  private subscribeToNotifications() {
    this.wsSubscription = this.notificationsService.wsMessages$.subscribe((msg) => {
      if (msg.type === 'notification') {
        const payload = msg.payload;
        this.unreadCount.update(c => c + 1);
        this.notifications.update(list => [
          {
            id: payload.id || Math.random().toString(),
            type: payload.type || 'like',
            message: payload.message || this.translate.instant('COMMUNITY.NOTIFICATIONS.DEFAULT_MESSAGE'),
            link_url: payload.link_url,
            is_read: false,
            created_at: new Date().toISOString()
          },
          ...list
        ]);
      }
    });
  }

  toggleDropdown() {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      this.loadNotifications();
    }
  }

  closeDropdown() {
    this.isOpen.set(false);
  }

  private loadUnreadCount() {
    this.notificationsService.getUnreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.unread_count),
      error: () => {
        this.unreadCount.set(0);
      }
    });
  }

  private loadNotifications() {
    this.notificationsService.getNotifications().subscribe({
      next: (res) => this.notifications.set(res),
      error: () => {
        this.notifications.set([]);
      }
    });
  }

  handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      this.notificationsService.markAsRead(notification.id).subscribe({
        next: () => {
          this.unreadCount.update(c => Math.max(0, c - 1));
          this.notifications.update(list => list.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        }
      });
    }
    
    if (notification.link_url) {
      this.router.navigateByUrl(notification.link_url);
    }
    this.closeDropdown();
  }

  markAllAsRead() {
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update(list => list.map(n => ({ ...n, is_read: true })));
      }
    });
  }
}
