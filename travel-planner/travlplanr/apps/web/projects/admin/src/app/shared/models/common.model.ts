/**
 * Common types shared across admin services.
 * Paged<T> is the standard paginated response shape.
 * ApiError is the normalized error shape from error.interceptor.
 */

/** Generic paginated response */
export interface Paged<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** KPI summary card — matches the existing summaryCards literal shape */
export interface SummaryCard {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  icon: string;
  trend: number[];
}

/** Normalized API error */
export interface ApiError {
  status: number;
  message: string;
  correlationId?: string;
}

/** KPI card from the API (before mapping to SummaryCard display shape) */
export interface KpiValue {
  value: number;
  change_pct: number;
  is_positive: boolean;
  sparkline: number[];
}

/** Dashboard summary response */
export interface DashboardSummary {
  total_customers: KpiValue;
  total_itinerary: KpiValue;
  total_staff: KpiValue;
  new_customers: KpiValue;
}

/** Chart trend data */
export interface TrendPoint {
  period: string;
  count: number;
}

export interface TrendResponse {
  series: TrendPoint[];
  y_max: number;
}

/** Donut chart segment */
export interface DonutSegment {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DonutResponse {
  total: number;
  segments: DonutSegment[];
}

/** Customer growth bar chart */
export interface GrowthPoint {
  period: string;
  new_customers: number;
}

export interface GrowthResponse {
  series: GrowthPoint[];
  y_max: number;
  unit: string;
}
