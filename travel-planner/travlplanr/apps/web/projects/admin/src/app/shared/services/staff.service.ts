/**
 * StaffService — replaces hardcoded staffList, summaryCards, and
 * selectedStaff in staff.component.ts.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SummaryCard } from '../models/common.model';
import { StaffRow, StaffApiResponse } from '../models/staff.model';

@Injectable({ providedIn: 'root' })
export class StaffService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<SummaryCard[]> {
    if (environment.useMockData) {
      return of(MOCK_STAFF_STATS);
    }
    return this.list({}).pipe(
      map((res) => [
        { title: 'Total Staff', value: res.kpis.total, change: '', isPositive: true, icon: 'group', trend: [] },
        { title: 'Active Staff', value: res.kpis.active, change: '', isPositive: true, icon: 'check_circle', trend: [] },
        { title: 'Inactive Staff', value: res.kpis.inactive, change: '', isPositive: false, icon: 'cancel', trend: [] },
      ])
    );
  }

  list(query: any): Observable<{ kpis: any; items: StaffRow[]; total: number; page: number; totalPages: number }> {
    if (environment.useMockData) {
      return of({
        kpis: { total: 15, active: 12, inactive: 3 },
        items: MOCK_STAFF_LIST,
        total: MOCK_STAFF_LIST.length,
        page: 1,
        totalPages: 1,
      });
    }

    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.sort) params = params.set('sort', query.sort);
    if (query.q) params = params.set('q', query.q);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.pageSize) params = params.set('page_size', query.pageSize.toString());

    return this.http
      .get<StaffApiResponse>(`${environment.identityPath}/admin/staff`, { params })
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

  getById(id: string): Observable<StaffRow> {
    if (environment.useMockData) {
      return of(MOCK_STAFF_LIST.find((s) => s.id === id) || MOCK_STAFF_LIST[0]);
    }

    return this.http
      .get<any>(`${environment.identityPath}/admin/staff/${id}`)
      .pipe(
        map((res) => ({
          id: res.id,
          displayCode: res.display_code,
          name: res.name,
          email: res.email,
          phone: res.phone || '',
          role: res.role,
          type: '',
          dateJoined: res.date_joined,
          lastLogin: res.last_login_at || 'Never',
          isActive: res.is_active,
          stats: res.stats || { customers: 0, itineraries: 0, booked: 0, pending: 0, created: 0 },
        }))
      );
  }

  private mapToRow(item: any): StaffRow & { status: string; location: string } {
    return {
      id: item.id,
      displayCode: item.display_code,
      name: item.name,
      email: item.email,
      phone: item.phone || '',
      role: item.role,
      type: '',
      dateJoined: item.date_joined || item.dateJoined,
      lastLogin: '',
      isActive: item.is_active !== undefined ? item.is_active : item.isActive,
      status: (item.is_active !== undefined ? item.is_active : item.isActive) ? 'Active' : 'Inactive',
      location: 'Remote',
      stats: { customers: 0, itineraries: 0, booked: 0, pending: 0, created: 0 },
    };
  }
  create(staff: any): Observable<any> {
    return this.http.post(`${environment.identityPath}/admin/staff`, staff);
  }

  update(id: string, staff: any): Observable<any> {
    return this.http.put(`${environment.identityPath}/admin/staff/${id}`, staff);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${environment.identityPath}/admin/staff/${id}`);
  }
}

const MOCK_STAFF_STATS: SummaryCard[] = [
  { title: 'Total Staff', value: 15, change: '', isPositive: true, icon: 'group', trend: [] },
  { title: 'Active Staff', value: 12, change: '', isPositive: true, icon: 'check_circle', trend: [] },
  { title: 'Inactive Staff', value: 3, change: '', isPositive: false, icon: 'cancel', trend: [] },
];

const MOCK_STAFF_LIST: (StaffRow & { status?: string; location?: string })[] = [
  { id: '1', displayCode: 'TPE000001', name: 'Admin User', email: 'admin@travlplanr.com', phone: '+91 98765 43200', role: 'Admin', type: 'Couple', dateJoined: 'Jan 01, 2025', lastLogin: 'Feb 02, 2025', isActive: true, status: 'Active', location: 'Remote', stats: { customers: 45, itineraries: 110, booked: 42, pending: 6, created: 62 } },
  { id: '2', displayCode: 'TPE000002', name: 'Sarah Johnson', email: 'sarah@travlplanr.com', phone: '+91 98765 43201', role: 'Manager', type: 'Solo', dateJoined: 'Jan 05, 2025', lastLogin: 'Feb 01, 2025', isActive: true, status: 'Active', location: 'Remote', stats: { customers: 30, itineraries: 85, booked: 30, pending: 5, created: 50 } },
  { id: '3', displayCode: 'TPE000003', name: 'Amit Kumar', email: 'amit@travlplanr.com', phone: '+91 98765 43202', role: 'Staff', type: 'Family', dateJoined: 'Jan 10, 2025', lastLogin: 'Jan 30, 2025', isActive: true, status: 'Active', location: 'Remote', stats: { customers: 25, itineraries: 65, booked: 22, pending: 3, created: 40 } },
  { id: '4', displayCode: 'TPE000004', name: 'Priya Mehta', email: 'priya@travlplanr.com', phone: '+91 98765 43203', role: 'Staff', type: 'Friends', dateJoined: 'Jan 12, 2025', lastLogin: 'Jan 28, 2025', isActive: false, status: 'Inactive', location: 'Remote', stats: { customers: 15, itineraries: 40, booked: 15, pending: 2, created: 23 } },
];
