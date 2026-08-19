import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface CommunityCollection {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  item_count: number;
  cover_image?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityCollectionService {
  constructor(private http: HttpClient) {}

  getCollections(): Observable<CommunityCollection[]> {
    return this.http.get<CommunityCollection[]>(apiUrl('/community/collections'));
  }

  createCollection(data: { name: string; description?: string; is_private?: boolean }): Observable<CommunityCollection> {
    return this.http.post<CommunityCollection>(apiUrl('/community/collections'), data);
  }

  savePostToCollection(collectionId: string, postId: string, note?: string): Observable<any> {
    return this.http.post(apiUrl(`/community/collections/${collectionId}/items`), {
      item_type: 'post',
      item_id: postId,
      note
    });
  }

  getCollection(id: string): Observable<CommunityCollection> {
    return this.http.get<CommunityCollection>(apiUrl(`/community/collections/${id}`));
  }

  deleteCollection(id: string): Observable<any> {
    return this.http.delete(apiUrl(`/community/collections/${id}`));
  }

  removeItemFromCollection(collectionId: string, itemId: string): Observable<any> {
    return this.http.delete(apiUrl(`/community/collections/${collectionId}/items/${itemId}`));
  }
}
