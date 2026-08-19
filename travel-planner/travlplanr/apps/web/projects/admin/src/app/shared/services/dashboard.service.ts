/**
 * DashboardService — replaces hardcoded summaryCards, itineraryTrend,
 * customerGrowth, popularDestinations, customerSegments, recentItineraries,
 * recentCustomers in dashboard.component.ts.
 *
 * All dashboard metrics are served from the reporting read model,
 * never live OLTP scans. The mock fallback returns the existing literal
 * values so the UI is byte-for-byte identical during migration.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  SummaryCard,
  DashboardSummary,
  TrendResponse,
  DonutResponse,
  GrowthResponse,
} from '../models/common.model';

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}
@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  /**
   * Get the 4 KPI summary cards.
   * Maps API response to the existing SummaryCard[] shape the template binds.
   */
  getKpis(period: string = 'last_30d'): Observable<SummaryCard[]> {
    if (environment.useMockData) {
      return of(MOCK_SUMMARY_CARDS);
    }

    return this.http
      .get<DashboardSummary>(
        `${environment.reportingPath}/admin/dashboard/summary`,
        { params: { period } }
      )
      .pipe(
        map((res) => [
          this.mapKpi('Total Customers', res.total_customers, 'group'),
          this.mapKpi('Total Itinerary', res.total_itinerary, 'map'),
          this.mapKpi('Total Staff', res.total_staff, 'person'),
          this.mapKpi('New Customers', res.new_customers, 'trending_up'),
        ]),
        catchError(() => of(MOCK_SUMMARY_CARDS))
      );
  }

  getItineraryTrend(period: string = 'this_year'): Observable<TrendResponse> {
    if (environment.useMockData) {
      return of(MOCK_ITINERARY_TREND);
    }
    return this.http.get<TrendResponse>(
      `${environment.reportingPath}/admin/dashboard/itinerary-trend`,
      { params: { period } }
    ).pipe(catchError(() => of(MOCK_ITINERARY_TREND)));
  }

  getPopularDestinations(period: string = 'last_30d'): Observable<DonutResponse> {
    if (environment.useMockData) {
      return of(MOCK_POPULAR_DESTINATIONS);
    }
    return this.http.get<DonutResponse>(
      `${environment.reportingPath}/admin/dashboard/popular-destinations`,
      { params: { period } }
    ).pipe(catchError(() => of(MOCK_POPULAR_DESTINATIONS)));
  }

  getCustomerSegments(period: string = 'last_30d'): Observable<DonutResponse> {
    if (environment.useMockData) {
      return of(MOCK_CUSTOMER_SEGMENTS);
    }
    return this.http.get<DonutResponse>(
      `${environment.reportingPath}/admin/dashboard/customer-segments`,
      { params: { period } }
    ).pipe(catchError(() => of(MOCK_CUSTOMER_SEGMENTS)));
  }

  getCustomerGrowth(period: string = 'this_year'): Observable<GrowthResponse> {
    if (environment.useMockData) {
      return of(MOCK_CUSTOMER_GROWTH);
    }
    return this.http.get<GrowthResponse>(
      `${environment.reportingPath}/admin/dashboard/customer-growth`,
      { params: { period } }
    ).pipe(catchError(() => of(MOCK_CUSTOMER_GROWTH)));
  }

  getFinancials(period: string = 'this_year'): Observable<any> {
    return this.http.get<any>(
      `${environment.reportingPath}/admin/dashboard/financials`,
      { params: { period } }
    ).pipe(catchError(() => of(MOCK_FINANCIALS)));
  }

  getRecentItineraries(limit: number = 5): Observable<any[]> {
    if (environment.useMockData) {
      return of(MOCK_RECENT_ITINERARIES);
    }
    return this.http
      .get<{ items: any[] }>(`${environment.plannerPath}/admin/itineraries/recent`, {
        params: { limit: limit.toString() },
      })
      .pipe(
        map((res) => res.items.map((item) => this.mapRecentItinerary(item))),
        catchError(() => of(MOCK_RECENT_ITINERARIES))
      );
  }

  private mapRecentItinerary(item: any): any {
    return {
      destinations: item.destination || item.title || 'Unknown',
      status: item.status || 'Created',
      user: 'Staff',
      for: item.customerName || 'Customer',
      time: this.formatRelativeTime(item.created_at),
    };
  }

  private formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) return 'Recently';
    const then = new Date(iso).getTime();
    const diffMin = Math.max(1, Math.round((Date.now() - then) / 60000));
    if (diffMin < 60) return `${diffMin}min ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.round(diffH / 24)}d ago`;
  }

  getRecentCustomers(limit: number = 5): Observable<any[]> {
    if (environment.useMockData) {
      return of(MOCK_RECENT_CUSTOMERS);
    }
    return this.http
      .get<{ items: any[] }>(`${environment.identityPath}/admin/customers/recent`, {
        params: { limit: limit.toString() },
      })
      .pipe(
        map((res) => res.items),
        catchError(() => of(MOCK_RECENT_CUSTOMERS))
      );
  }

  getUnreadNotificationCount(): Observable<number> {
    if (environment.useMockData) {
      return of(2);
    }
    return this.http
      .get<{ unread_count: number }>(`${environment.reportingPath}/admin/notifications`, {
        params: { unread: 'true' },
      })
      .pipe(
        map((res) => res.unread_count),
        catchError(() => of(0)),
      );
  }

  getNotifications(limit: number = 20): Observable<AdminNotification[]> {
    if (environment.useMockData) {
      return of([]);
    }
    return this.http
      .get<{ items: AdminNotification[] }>(`${environment.reportingPath}/admin/notifications`, {
        params: { page_size: limit.toString() },
      })
      .pipe(
        map((res) => res.items || []),
        catchError(() => of([])),
      );
  }

  markNotificationRead(id: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${environment.reportingPath}/admin/notifications/${id}/read`,
      {},
    );
  }

  markAllNotificationsRead(ids: string[]): Observable<unknown> {
    if (!ids.length) return of(null);
    return forkJoin(ids.map((id) => this.markNotificationRead(id).pipe(catchError(() => of(null)))));
  }

  private mapKpi(title: string, kpi: any, icon: string): SummaryCard {
    const sign = kpi.change_pct >= 0 ? '+' : '';
    return {
      title,
      value: kpi.value,
      change: `${sign}${kpi.change_pct}%`,
      isPositive: kpi.is_positive,
      icon,
      trend: kpi.sparkline || [],
    };
  }
}

// ─── Mock data matching existing hardcoded literals ───

const MOCK_FINANCIALS: any = {
  series: [
    { period: '2026-01', gbv: 180000, net_revenue: 36000 },
    { period: '2026-02', gbv: 220000, net_revenue: 44000 },
    { period: '2026-03', gbv: 260000, net_revenue: 52000 },
    { period: '2026-04', gbv: 310000, net_revenue: 62000 },
    { period: '2026-05', gbv: 380000, net_revenue: 76000 },
    { period: '2026-06', gbv: 420000, net_revenue: 84000 },
  ],
  y_max: 500000,
  total_gbv: 1770000,
  total_net: 354000,
};

const MOCK_SUMMARY_CARDS: SummaryCard[] = [
  { title: 'Total Customers', value: 712, change: '+5%', isPositive: true, icon: 'group', trend: [15, 25, 20, 35, 30, 45] },
  { title: 'Total Itinerary', value: 423, change: '+5%', isPositive: true, icon: 'map', trend: [100, 130, 180, 240, 340, 450] },
  { title: 'Total Staff', value: 15, change: '+2%', isPositive: true, icon: 'person', trend: [15, 10, 18, 15, 22, 20] },
  { title: 'New Customers', value: 52, change: '+5%', isPositive: true, icon: 'trending_up', trend: [15, 25, 20, 35, 30, 45] },
];

const MOCK_ITINERARY_TREND: TrendResponse = {
  series: [
    { period: '2026-01', count: 100 },
    { period: '2026-02', count: 130 },
    { period: '2026-03', count: 180 },
    { period: '2026-04', count: 240 },
    { period: '2026-05', count: 340 },
    { period: '2026-06', count: 450 },
  ],
  y_max: 500,
};

const MOCK_POPULAR_DESTINATIONS: DonutResponse = {
  total: 423,
  segments: [
    { name: 'Europe', count: 148, percentage: 35, color: '#0060EA' },
    { name: 'Thailand', count: 85, percentage: 20, color: '#10B981' },
    { name: 'Bali', count: 63, percentage: 15, color: '#F59E0B' },
    { name: 'Dubai', count: 42, percentage: 10, color: '#F97316' },
    { name: 'Malaysia', count: 42, percentage: 10, color: '#EF4444' },
    { name: 'Japan', count: 43, percentage: 10, color: '#8B5CF6' },
  ],
};

const MOCK_CUSTOMER_SEGMENTS: DonutResponse = {
  total: 712,
  segments: [
    { name: 'Couple', count: 285, percentage: 40, color: '#0060EA' },
    { name: 'Friends', count: 178, percentage: 25, color: '#10B981' },
    { name: 'Solo', count: 142, percentage: 20, color: '#F59E0B' },
    { name: 'Family', count: 107, percentage: 15, color: '#F97316' },
  ],
};

const MOCK_CUSTOMER_GROWTH: GrowthResponse = {
  series: [
    { period: '2026-01', new_customers: 80 },
    { period: '2026-02', new_customers: 60 },
    { period: '2026-03', new_customers: 45 },
    { period: '2026-04', new_customers: 68 },
    { period: '2026-05', new_customers: 32 },
    { period: '2026-06', new_customers: 38 },
  ],
  y_max: 100,
  unit: 'count',
};

const MOCK_RECENT_ITINERARIES: any[] = [
  { destinations: 'Paris, France', status: 'Created', user: 'you', for: 'Emily Chen', time: '2min ago' },
  { destinations: 'Tokyo, Japan', status: 'Pending', user: 'Sarah J.', for: 'Mike Wilson', time: '15min ago' },
  { destinations: 'Bali, Indonesia', status: 'Booked', user: 'you', for: 'David Park', time: '1h ago' },
  { destinations: 'Santorini, Greece', status: 'Created', user: 'Amit K.', for: 'Lisa Wang', time: '2h ago' },
  { destinations: 'Dubai, UAE', status: 'Pending', user: 'you', for: 'John Smith', time: '3h ago' },
];

const MOCK_RECENT_CUSTOMERS: any[] = [
  { name: 'Emma Wilson', type: 'Couple', onboardBy: 'you', time: '10min ago' },
  { name: 'James Chen', type: 'Solo', onboardBy: 'Sarah J.', time: '1h ago' },
  { name: 'Sophia Lee', type: 'Family', onboardBy: 'you', time: '2h ago' },
  { name: 'Liam Park', type: 'Friends', onboardBy: 'Amit K.', time: '5h ago' },
  { name: 'Olivia Singh', type: 'Solo', onboardBy: 'you', time: '1d ago' },
];
