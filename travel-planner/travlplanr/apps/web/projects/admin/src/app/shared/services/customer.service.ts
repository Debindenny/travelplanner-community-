/**
 * CustomerService — replaces hardcoded customerList, summaryCards, and
 * selectedCustomer in customer.component.ts.
 *
 * Maps API response fields (display_code, date_joined, customer_type) into
 * the legacy display strings the template expects (id, dateJoined, type).
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SummaryCard } from '../models/common.model';
import {
  CustomerRow,
  CustomerApiResponse,
  CustomerKpis,
  CreateCustomerRequest,
} from '../models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  constructor(private http: HttpClient) {}

  /**
   * Get KPI stats cards — Total/Active/Inactive.
   * Active + Inactive == Total is guaranteed by the API.
   */
  getStats(): Observable<SummaryCard[]> {
    if (environment.useMockData) {
      return of(MOCK_CUSTOMER_STATS);
    }
    return this.list({}).pipe(
      map((res) => [
        { title: 'Total Customers', value: res.kpis.total, change: '', isPositive: true, icon: 'group', trend: [] },
        { title: 'Active Customers', value: res.kpis.active, change: '', isPositive: true, icon: 'check_circle', trend: [] },
        { title: 'Inactive Customers', value: res.kpis.inactive, change: '', isPositive: false, icon: 'cancel', trend: [] },
      ])
    );
  }

  /**
   * List customers with pagination, search, sort, filter.
   * Returns Paged<CustomerRow> with items mapped to the legacy display shape.
   */
  list(query: any): Observable<{ kpis: CustomerKpis; items: CustomerRow[]; total: number; page: number; totalPages: number }> {
    if (environment.useMockData) {
      return of({
        kpis: { total: 712, active: 680, inactive: 32 },
        items: MOCK_CUSTOMER_LIST,
        total: MOCK_CUSTOMER_LIST.length,
        page: 1,
        totalPages: 1,
      });
    }

    let params = new HttpParams();
    if (query.period) params = params.set('period', query.period);
    if (query.status) params = params.set('status', query.status);
    if (query.sort) params = params.set('sort', query.sort);
    if (query.q) params = params.set('q', query.q);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.pageSize) params = params.set('page_size', query.pageSize.toString());

    return this.http
      .get<CustomerApiResponse>(`${environment.identityPath}/admin/customers`, { params })
      .pipe(
        map((res) => ({
          kpis: res.kpis,
          items: res.items.map((item) => this.mapToRow(item)),
          total: res.total,
          page: res.page,
          totalPages: res.total_pages,
        }))
      );
  }

  /**
   * Get customer by ID — composes identity profile + reporting E18 stats.
   */
  getById(id: string): Observable<CustomerRow> {
    if (environment.useMockData) {
      const found = MOCK_CUSTOMER_LIST.find((c) => c.id === id);
      return of(found || MOCK_CUSTOMER_LIST[0]);
    }

    return this.http
      .get<any>(`${environment.identityPath}/admin/customers/${id}`)
      .pipe(
        map((res) => ({
          id: res.id,
          displayCode: res.display_code,
          name: res.name,
          email: res.email,
          phone: res.phone || '',
          type: res.customer_type || '',
          dateJoined: res.date_joined,
          lastLogin: res.last_login_at || 'Never',
          isActive: res.is_active,
          ltv: res.ltv || 0,
          segment: res.segment || 'Prospect',
          stats: res.stats || { cancelled: 0, itineraries: 0, booked: 0, pending: 0, created: 0 },
        }))
      );
  }

  create(body: CreateCustomerRequest): Observable<any> {
    return this.http.post(`${environment.identityPath}/admin/customers`, body);
  }

  update(id: string, body: any): Observable<any> {
    return this.http.put(`${environment.identityPath}/admin/customers/${id}`, body);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${environment.identityPath}/admin/customers/${id}`);
  }

  /** Map API item to the legacy CustomerRow shape the template binds */
  private mapToRow(item: any): CustomerRow {
    return {
      id: item.id,
      displayCode: item.display_code,
      name: item.name,
      email: item.email,
      phone: item.phone || '',
      type: item.customer_type || '',
      dateJoined: item.date_joined,
      lastLogin: '', // populated on detail fetch
      isActive: item.is_active,
      ltv: item.ltv || 0,
      segment: item.segment || 'Prospect',
      stats: { cancelled: 0, itineraries: 0, booked: 0, pending: 0, created: 0 },
    };
  }
}

// ─── Mock data matching existing hardcoded literals ───

const MOCK_CUSTOMER_STATS: SummaryCard[] = [
  { title: 'Total Customers', value: 712, change: '', isPositive: true, icon: 'group', trend: [] },
  { title: 'Active Customers', value: 680, change: '', isPositive: true, icon: 'check_circle', trend: [] },
  { title: 'Inactive Customers', value: 32, change: '', isPositive: false, icon: 'cancel', trend: [] },
];

const MOCK_CUSTOMER_LIST: CustomerRow[] = [
  { id: '1', displayCode: 'CUS000001', name: 'Arjun Patel', email: 'arjun@email.com', phone: '+91 98765 43210', type: 'Couple', dateJoined: 'Jan 21, 2025', lastLogin: 'Feb 02, 2025', isActive: true, ltv: 3750, segment: 'High Value', stats: { cancelled: 2, itineraries: 7, booked: 3, pending: 1, created: 3 } },
  { id: '2', displayCode: 'CUS000002', name: 'Priya Sharma', email: 'priya@email.com', phone: '+91 98765 43211', type: 'Solo', dateJoined: 'Jan 18, 2025', lastLogin: 'Jan 30, 2025', isActive: true, ltv: 2500, segment: 'Active Customer', stats: { cancelled: 1, itineraries: 5, booked: 2, pending: 1, created: 2 } },
  { id: '3', displayCode: 'CUS000003', name: 'Rahul Verma', email: 'rahul@email.com', phone: '+91 98765 43212', type: 'Family', dateJoined: 'Jan 15, 2025', lastLogin: 'Jan 28, 2025', isActive: true, ltv: 1250, segment: 'Active Customer', stats: { cancelled: 0, itineraries: 3, booked: 1, pending: 1, created: 1 } },
  { id: '4', displayCode: 'CUS000004', name: 'Neha Gupta', email: 'neha@email.com', phone: '+91 98765 43213', type: 'Friends', dateJoined: 'Jan 10, 2025', lastLogin: 'Jan 25, 2025', isActive: false, ltv: 5000, segment: 'High Value', stats: { cancelled: 3, itineraries: 8, booked: 4, pending: 2, created: 2 } },
];
