import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import { AdminNotification, DashboardService } from '../../shared/services/dashboard.service';
import { ThemeService } from 'ui';
import { BehaviorSubject, Observable, of, switchMap, timer } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
    selector: 'app-admin-layout',
    imports: [CommonModule, RouterModule],
    templateUrl: './admin-layout.component.html'
})
export class AdminLayoutComponent {
  authService = inject(AdminAuthService);
  themeService = inject(ThemeService);
  private dashboardService = inject(DashboardService);

  sidebarCollapsed = signal(false);
  showNotifDropdown = false;
  showUserMenu = false;
  isLoading = false;

  notifications: AdminNotification[] = [];
  private refreshNotifs$ = new BehaviorSubject<void>(undefined);

  notifCount$: Observable<number> = this.refreshNotifs$.pipe(
    switchMap(() =>
      timer(0, 60_000).pipe(
        switchMap(() => this.dashboardService.getUnreadNotificationCount()),
      ),
    ),
  );

  toggleSidebar() {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  toggleNotifDropdown() {
    this.showNotifDropdown = !this.showNotifDropdown;
    if (this.showNotifDropdown) {
      this.loadNotifications();
    }
  }

  loadNotifications() {
    this.dashboardService.getNotifications(10).subscribe((items) => {
      this.notifications = items;
    });
  }

  markOneRead(n: AdminNotification, event?: Event) {
    event?.stopPropagation();
    if (n.is_read) return;
    this.dashboardService.markNotificationRead(n.id).subscribe({
      next: () => {
        n.is_read = true;
        this.refreshNotifs$.next();
      },
    });
  }

  markAllRead(event?: Event) {
    event?.stopPropagation();
    const unreadIds = this.notifications.filter((n) => !n.is_read).map((n) => n.id);
    const mark$ = unreadIds.length
      ? this.dashboardService.markAllNotificationsRead(unreadIds)
      : this.dashboardService.getNotifications(50).pipe(
          switchMap((items) => {
            const ids = items.filter((i) => !i.is_read).map((i) => i.id);
            return this.dashboardService.markAllNotificationsRead(ids);
          }),
          catchError(() => of(null)),
        );

    mark$.subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) => ({ ...n, is_read: true }));
        this.refreshNotifs$.next();
      },
    });
  }

  relativeTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffMin = Math.max(1, Math.round((Date.now() - then) / 60000));
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.round(diffH / 24)}d ago`;
  }

  logout() {
    this.authService.logout();
  }

  getUserInitial(): string {
    const name = this.authService.currentUser()?.name;
    return name ? name.charAt(0).toUpperCase() : 'A';
  }

  getUserFirstName(): string {
    const name = this.authService.currentUser()?.name;
    return name ? name.split(' ')[0] : 'Admin';
  }
}
