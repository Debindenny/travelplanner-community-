/**
 * ItineraryService — replaces hardcoded itineraryList and summaryCards
 * in itinerary.component.ts.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SummaryCard } from '../models/common.model';
import { ItineraryRow, ItineraryKpis } from '../models/itinerary.model';

@Injectable({ providedIn: 'root' })
export class ItineraryService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<SummaryCard[]> {
    if (environment.useMockData) {
      return of(MOCK_ITINERARY_STATS);
    }
    return this.list({}).pipe(
      map((res) => [
        { title: 'Total Itineraries', value: res.kpis.total, change: '', isPositive: true, icon: 'map', trend: [] },
        { title: 'Pending Itineraries', value: res.kpis.pending, change: '', isPositive: true, icon: 'pending', trend: [] },
        { title: 'Created Itineraries', value: res.kpis.created, change: '', isPositive: true, icon: 'add_circle', trend: [] },
        { title: 'Booked Itineraries', value: res.kpis.booked, change: '', isPositive: true, icon: 'check_circle', trend: [] },
      ])
    );
  }

  list(query: any): Observable<{ kpis: ItineraryKpis; items: ItineraryRow[]; total: number; page: number; totalPages: number }> {
    if (environment.useMockData) {
      return of({
        kpis: { total: 423, pending: 18, created: 142, booked: 263 },
        items: MOCK_ITINERARY_LIST,
        total: MOCK_ITINERARY_LIST.length,
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
      .get<any>(`${environment.plannerPath}/admin/itineraries`, { params })
      .pipe(
        map((res: any) => ({
          kpis: res.kpis,
          items: (res.items || []).map((item: any) => this.mapToRow(item)),
          total: res.total,
          page: res.page,
          totalPages: res.total_pages,
        }))
      );
  }

  getById(id: string): Observable<ItineraryRow> {
    if (environment.useMockData) {
      return of(MOCK_ITINERARY_LIST.find((i) => i.id === id) || MOCK_ITINERARY_LIST[0]);
    }
    return this.http
      .get<any>(`${environment.plannerPath}/admin/itineraries/${id}`)
      .pipe(map((res) => this.mapToRow(res)));
  }

  create(body: any): Observable<any> {
    return this.http.post(`${environment.plannerPath}/admin/itineraries`, body);
  }

  update(id: string, body: any): Observable<any> {
    return this.http.put(`${environment.plannerPath}/admin/itineraries/${id}`, body);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${environment.plannerPath}/admin/itineraries/${id}`);
  }

  private mapToRow(item: any): ItineraryRow {
    return {
      id: item.id,
      displayCode: item.display_code,
      customerName: item.customer_name || item.customerName || '',
      customerId: item.customer_ref_code || item.customerId || '',
      destination: item.destination_text || item.destination || '',
      duration: item.duration || '',
      travelDates: item.travel_dates || item.travelDates || '',
      traveler: item.traveler || '',
      type: item.travel_style || item.type || '',
      status: item.status || 'Created',
      departureReturn: item.departure_return || item.departureReturn || '',
      title: item.title || '',
      curator: item.curator_name || item.curator || '',
      curatorPhone: item.curator_phone || item.curatorPhone || '',
    };
  }
}

const MOCK_ITINERARY_STATS: SummaryCard[] = [
  { title: 'Total Itineraries', value: 423, change: '', isPositive: true, icon: 'map', trend: [] },
  { title: 'Pending Itineraries', value: 18, change: '', isPositive: true, icon: 'pending', trend: [] },
  { title: 'Created Itineraries', value: 142, change: '', isPositive: true, icon: 'add_circle', trend: [] },
  { title: 'Booked Itineraries', value: 263, change: '', isPositive: true, icon: 'check_circle', trend: [] },
];

const MOCK_ITINERARY_LIST: ItineraryRow[] = [
  { id: '1', displayCode: 'TPU000001', customerName: 'Arjun Patel', customerId: 'TPC000001', destination: 'Paris, France', duration: '7 days / 6 nights', travelDates: 'Mar 15 - Mar 22, 2025', traveler: 'Adult 2', type: 'Honeymoon', status: 'Created', departureReturn: 'Mumbai → Paris', title: 'Romantic Paris Getaway', curator: 'Admin User', curatorPhone: '+91 98765 43200' },
  { id: '2', displayCode: 'TPU000002', customerName: 'Priya Sharma', customerId: 'TPC000002', destination: 'Tokyo, Japan', duration: '10 days / 9 nights', travelDates: 'Apr 01 - Apr 10, 2025', traveler: 'Adult 1', type: 'Adventure', status: 'Pending', departureReturn: 'Delhi → Tokyo', title: 'Solo Japan Explorer', curator: 'Sarah Johnson', curatorPhone: '+91 98765 43201' },
  { id: '3', displayCode: 'TPU000003', customerName: 'Rahul Verma', customerId: 'TPC000003', destination: 'Bali, Indonesia', duration: '5 days / 4 nights', travelDates: 'May 10 - May 15, 2025', traveler: 'Adult 2, Child 1', type: 'Family', status: 'Booked', departureReturn: 'Bangalore → Bali', title: 'Bali Family Vacation', curator: 'Amit Kumar', curatorPhone: '+91 98765 43202' },
  { id: '4', displayCode: 'TPU000004', customerName: 'Neha Gupta', customerId: 'TPC000004', destination: 'Santorini, Greece', duration: '8 days / 7 nights', travelDates: 'Jun 01 - Jun 08, 2025', traveler: 'Adult 4', type: 'Friends', status: 'Created', departureReturn: 'Mumbai → Santorini', title: 'Greek Islands Adventure', curator: 'Admin User', curatorPhone: '+91 98765 43200' },
];
