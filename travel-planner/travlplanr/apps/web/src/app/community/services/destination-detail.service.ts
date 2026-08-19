import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface DestinationDetail {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  region: string;
  tags: string[];
  latitude?: number | null;
  longitude?: number | null;
  been_there_count: number;
}

export interface DestinationDetailResponse {
  destination: DestinationDetail;
  posts: import('./community-post.service').CommunityPost[];
  has_more: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DestinationService {
  constructor(private http: HttpClient) {}

  getDestination(id: string, limit: number = 20, offset: number = 0): Observable<DestinationDetailResponse> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return this.http.get<DestinationDetailResponse>(
      apiUrl(`/destinations/${id}?${params.toString()}`)
    );
  }

  loadMorePosts(id: string, limit: number = 20, offset: number = 0): Observable<{ posts: import('./community-post.service').CommunityPost[]; has_more: boolean }> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return this.http.get<{ posts: import('./community-post.service').CommunityPost[]; has_more: boolean }>(
      apiUrl(`/destinations/${id}?${params.toString()}`)
    );
  }

}
