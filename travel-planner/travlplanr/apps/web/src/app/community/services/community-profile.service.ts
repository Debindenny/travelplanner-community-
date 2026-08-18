import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface UserProfile {
  customer_id: string;
  name: string;
  avatar: string | null;
  bio?: string;
  posts_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_verified?: boolean;
  countries_visited?: number;
  local_in?: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string | null;
  is_following: boolean;
}

export interface PaginatedPosts {
  posts: any[];
}

export interface MyCommunityProfile {
  customer_id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  profile_views: number;
  followers_count: number;
  is_verified?: boolean;
  countries_visited?: number;
  local_in?: string | null;
}

export interface CommunityShortcut {
  id: string;
  title: string;
  url: string | null;
  icon_type: string;
}

export interface CommunityNews {
  id: string;
  title: string;
  readers: number;
  timeframe: string;
  bullet_color: string;
  link?: string | null;
  image_url?: string | null;
}

export interface CommunityAd {
  id: string;
  sponsor_name: string;
  sponsor_avatar?: string | null;
  tagline: string;
  body: string;
  button_text: string;
  click_url?: string | null;
}

export interface TrendingHashtag {
  name: string;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class CommunityProfileService {
  private readonly http = inject(HttpClient);

  getUserProfile(customerId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(apiUrl(`/community/users/${customerId}`));
  }

  getUserPosts(customerId: string, limit: number = 20, offset: number = 0): Observable<any[]> {
    return this.http.get<any[]>(apiUrl(`/community/users/${customerId}/posts?limit=${limit}&offset=${offset}`));
  }

  toggleFollow(customerId: string): Observable<{ status: string; action: string; is_following: boolean }> {
    return this.http.post<{ status: string; action: string; is_following: boolean }>(apiUrl(`/community/users/${customerId}/follow`), {});
  }

  getFollowers(customerId: string, limit: number = 20, offset: number = 0): Observable<User[]> {
    return this.http.get<User[]>(apiUrl(`/community/users/${customerId}/followers?limit=${limit}&offset=${offset}`));
  }

  getFollowing(customerId: string, limit: number = 20, offset: number = 0): Observable<User[]> {
    return this.http.get<User[]>(apiUrl(`/community/users/${customerId}/following?limit=${limit}&offset=${offset}`));
  }

  searchUsers(query: string, limit: number = 20, offset: number = 0): Observable<User[]> {
    return this.http.get<User[]>(
      apiUrl(`/community/users/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`)
    );
  }

  getMyProfile(): Observable<MyCommunityProfile> {
    return this.http.get<MyCommunityProfile>(apiUrl('/community/profile/me'));
  }

  getShortcuts(): Observable<CommunityShortcut[]> {
    return this.http.get<CommunityShortcut[]>(apiUrl('/community/shortcuts'));
  }

  getNews(): Observable<CommunityNews[]> {
    return this.http.get<CommunityNews[]>(apiUrl('/community/news'));
  }

  updateProfile(data: { name?: string; bio?: string; avatar?: string; local_in?: string }): Observable<UserProfile> {
    return this.http.put<UserProfile>(apiUrl('/community/profile/me'), data);
  }

  uploadImage(file: File): Observable<{url: string; thumbnailUrl?: string}> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{url: string; thumbnailUrl?: string}>(apiUrl('/community/upload'), formData);
  }

  getAd(): Observable<CommunityAd> {
    return this.http.get<CommunityAd>(apiUrl('/community/ads'));
  }

  getTrendingHashtags(limit = 10): Observable<TrendingHashtag[]> {
    return this.http.get<TrendingHashtag[]>(apiUrl(`/community/hashtags/trending?limit=${limit}`));
  }

  getFollowedHashtags(): Observable<string[]> {
    return this.http.get<string[]>(apiUrl('/community/hashtags/followed'));
  }

  incrementProfileView(userId: string): Observable<void> {
    return this.http.post<void>(apiUrl(`/community/users/${userId}/view`), {});
  }
}
