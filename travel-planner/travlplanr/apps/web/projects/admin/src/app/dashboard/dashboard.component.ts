import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminAuthService } from '../shared/services/admin-auth.service';
import { DashboardService } from '../shared/services/dashboard.service';
import { SummaryCard, TrendResponse, DonutResponse, GrowthResponse } from '../shared/models/common.model';
import { Observable, Subscription, timer, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { SkeletonComponent, EmptyStateComponent } from 'ui';
import { DashboardSocketService } from '../shared/services/dashboard-socket.service';

@Component({
    selector: 'app-dashboard',
    imports: [CommonModule, RouterModule, SkeletonComponent, EmptyStateComponent],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private dashboardSocket = inject(DashboardSocketService);
  authService = inject(AdminAuthService);

  months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  summaryCards$!: Observable<SummaryCard[]>;
  itineraryTrend$!: Observable<any>;
  popularDestinations$!: Observable<any>;
  customerSegments$!: Observable<any>;
  customerGrowth$!: Observable<any>;
  financials$!: Observable<any>;
  recentItineraries$!: Observable<any[]>;
  recentCustomers$!: Observable<any[]>;

  isLoadingCards = true;
  isLoadingCharts = true;
  isLoadingRecent = true;

  period = 'last_30d';
  tooltipData: { x: number; y: number; label: string; value: string } | null = null;
  barTooltip: { x: number; y: number; label: string; value: string } | null = null;
  finTooltip: { x: number; y: number; label: string; gbv: string; net: string } | null = null;

  private refreshSub?: Subscription;
  private socketSub?: Subscription;

  get firstName(): string {
    const name = this.authService.currentUser()?.name;
    return name ? name.split(' ')[0] : 'Admin';
  }

  ngOnInit() {
    // Real-time push from reporting (see DashboardSocketService) drives most
    // refreshes; this poll is just the fallback if the socket never connects.
    this.refreshSub = timer(0, 120_000).subscribe(() => this.load());

    this.dashboardSocket.connect();
    this.socketSub = this.dashboardSocket.onUpdate().subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
    this.socketSub?.unsubscribe();
    this.dashboardSocket.disconnect();
  }

  onPeriodChange(value: string) {
    this.period = value;
    this.load();
  }

  private load() {
    const period = this.period;
    this.isLoadingCards = true;
    this.isLoadingCharts = true;
    this.isLoadingRecent = true;

    this.summaryCards$ = this.dashboardService.getKpis(period).pipe(
      map(cards => { this.isLoadingCards = false; return cards; })
    );

    this.itineraryTrend$ = this.dashboardService.getItineraryTrend(period).pipe(
      map(trend => { this.isLoadingCharts = false; return this.processTrend(trend); })
    );

    this.popularDestinations$ = this.dashboardService.getPopularDestinations(period).pipe(
      map(donut => this.processDonut(donut))
    );

    this.customerSegments$ = this.dashboardService.getCustomerSegments(period).pipe(
      map(donut => this.processDonut(donut))
    );

    this.customerGrowth$ = this.dashboardService.getCustomerGrowth(period).pipe(
      map(growth => { return this.processGrowth(growth); })
    );

    this.financials$ = this.dashboardService.getFinancials(period).pipe(
      map(res => this.processFinancials(res))
    );

    this.recentItineraries$ = this.dashboardService.getRecentItineraries().pipe(
      map(items => { this.isLoadingRecent = false; return items; })
    );
    this.recentCustomers$ = this.dashboardService.getRecentCustomers();
  }

  private processFinancials(res: any): any {
    const chartWidth = 500;
    const chartHeight = 400;
    const marginX = 20;
    const paddingY = 20;
    
    if (!res.series || res.series.length === 0) return res;

    const count = res.series.length;
    const stepX = (chartWidth - 2 * marginX) / Math.max(1, count - 1);
    
    let pathGbv = '';
    let pathNet = '';
    let areaGbv = '';
    let areaNet = '';

    const points = res.series.map((pt: any, i: number) => {
      const x = marginX + i * stepX;
      // Normalize y
      const gbvPct = res.y_max > 0 ? pt.gbv / res.y_max : 0;
      const netPct = res.y_max > 0 ? pt.net_revenue / res.y_max : 0;
      
      const gbvY = chartHeight - paddingY - (gbvPct * (chartHeight - 2 * paddingY));
      const netY = chartHeight - paddingY - (netPct * (chartHeight - 2 * paddingY));

      const cmd = i === 0 ? 'M' : 'L';
      pathGbv += `${cmd} ${x},${gbvY} `;
      pathNet += `${cmd} ${x},${netY} `;

      return { x, gbvY, netY, period: pt.period, gbv: pt.gbv, net: pt.net_revenue };
    });

    if (points.length > 0) {
      const firstX = points[0].x;
      const lastX = points[points.length - 1].x;
      const baseY = chartHeight - paddingY;
      areaGbv = `${pathGbv} L ${lastX},${baseY} L ${firstX},${baseY} Z`;
      areaNet = `${pathNet} L ${lastX},${baseY} L ${firstX},${baseY} Z`;
    }

    return {
      ...res,
      yLabels: ['₹400k', '₹300k', '₹200k', '₹100k', '₹0'],
      pathGbv,
      pathNet,
      areaGbv,
      areaNet,
      points
    };
  }

  showFinTooltip(event: MouseEvent, pt: any) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.finTooltip = {
      x: pt.x,
      y: pt.gbvY,
      label: pt.period,
      gbv: `₹${(pt.gbv / 1000).toFixed(1)}k`,
      net: `₹${(pt.net / 1000).toFixed(1)}k`
    };
  }

  hideFinTooltip() {
    this.finTooltip = null;
  }

  private processDonut(donut: DonutResponse): any {
    const total = donut.segments.reduce((sum, s) => sum + s.count, 0) || 1;
    let currentAngle = 0;
    const circumference = 219.9;

    const slices = donut.segments.map(seg => {
      const percentage = seg.count / total;
      const length = percentage * circumference;
      const offset = circumference - length;
      const rotation = currentAngle;
      currentAngle += percentage * 360;
      return { ...seg, percentage: Math.round(percentage * 100), offset, rotation };
    });

    return { ...donut, slices };
  }

  private processTrend(trend: TrendResponse): any {
    const max = trend.y_max || Math.max(...trend.series.map(s => s.count), 10);
    const pathPoints = trend.series.map((s, i) => {
      const x = i * (500 / Math.max(trend.series.length - 1, 1));
      const y = 400 - ((s.count / max) * 350);
      return { x, y, ...s };
    });

    const d = pathPoints.length ? `M ${pathPoints.map(p => `${p.x},${p.y}`).join(' L ')}` : '';
    // Area path for gradient fill
    const areaD = pathPoints.length
      ? `M ${pathPoints[0].x},400 L ${pathPoints.map(p => `${p.x},${p.y}`).join(' L ')} L ${pathPoints[pathPoints.length - 1].x},400 Z`
      : '';
    const yLabels = [max, max * 0.8, max * 0.6, max * 0.4, max * 0.2, 0].map(Math.round);

    return { ...trend, max, pathPoints, d, areaD, yLabels };
  }

  private processGrowth(growth: GrowthResponse): any {
    const max = growth.y_max || Math.max(...growth.series.map(s => s.new_customers || 0), 10);
    const series = growth.series.map(s => {
      const val = s.new_customers || 0;
      return { ...s, heightPct: Math.min((val / max) * 100, 100), rawValue: val };
    });
    const yLabels = [max, max * 0.8, max * 0.6, max * 0.4, max * 0.2, 0].map(Math.round);
    return { ...growth, series, yLabels };
  }

  showTooltip(event: MouseEvent, point: any) {
    const rect = (event.target as SVGElement).closest('svg')?.getBoundingClientRect();
    if (!rect) return;
    this.tooltipData = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 40,
      label: point.period || '',
      value: point.count?.toString() || ''
    };
  }

  hideTooltip() { this.tooltipData = null; }

  showBarTooltip(event: MouseEvent, item: any) {
    const el = event.currentTarget as HTMLElement;
    const rect = el.parentElement?.getBoundingClientRect();
    if (!rect) return;
    this.barTooltip = {
      x: el.offsetLeft,
      y: -30,
      label: item.period,
      value: item.rawValue?.toString() || ''
    };
  }

  hideBarTooltip() { this.barTooltip = null; }

  logout() { this.authService.logout(); }
}
