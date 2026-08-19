import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventoryItem, InventoryType } from '../models/inventory.model';

export interface InventorySearchParams {
  type: InventoryType;
  location?: string;
  dep?: string;
  arr?: string;
  date?: string;
  budget?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);

  search(params: InventorySearchParams): Observable<InventoryItem[]> {
    let httpParams = new HttpParams()
      .set('type', params.type)
      .set('budget', params.budget || 'standard');

    if (params.location) httpParams = httpParams.set('location', params.location);
    if (params.dep) httpParams = httpParams.set('dep', params.dep);
    if (params.arr) httpParams = httpParams.set('arr', params.arr);
    if (params.date) httpParams = httpParams.set('date', params.date);

    return this.http
      .get<Record<string, unknown>[]>(`${environment.apiBaseUrl}/inventory/search`, { params: httpParams })
      .pipe(
        map((items) => items.map((item) => this.normalizeItem(item))),
        catchError(() => of([])),
      );
  }

  private normalizeItem(raw: Record<string, unknown>): InventoryItem {
    const nestedPrice = raw['price'] as { amount?: number } | number | undefined;
    const price =
      typeof nestedPrice === 'object' && nestedPrice !== null
        ? Number(nestedPrice.amount ?? 0)
        : Number(raw['price'] ?? 0);

    return {
      id: String(raw['id'] ?? ''),
      type: String(raw['type'] ?? ''),
      provider: String(raw['provider'] ?? ''),
      title: String(raw['title'] ?? ''),
      price,
      currency: String(raw['currency'] ?? 'USD'),
      deep_link: String(raw['deep_link'] ?? '#'),
      start_time: raw['start_time'] as string | undefined,
      end_time: raw['end_time'] as string | undefined,
      duration: raw['duration'] as string | undefined,
      details: (raw['details'] ?? raw['metadata']) as Record<string, unknown> | undefined,
    };
  }
}
