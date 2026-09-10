import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';

export interface Story {
  id: string;
  media_url: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  likes_count: number;
  views_count: number;
  liked_by_me: boolean;
}

export interface StoryGroup {
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
  stories: Story[];
}

export interface StoryViewer {
  customer_id: string;
  name: string;
  avatar: string | null;
  viewed_at: string;
}

@Injectable({ providedIn: 'root' })
export class CommunityStoryService {
  private readonly http = inject(HttpClient);

  getFeed(): Observable<{ feed: StoryGroup[] }> {
    return this.http.get<{ feed: StoryGroup[] }>(apiUrl('/community/stories/feed'));
  }

  getUserStories(customerId: string): Observable<Story[]> {
    return this.http.get<Story[]>(apiUrl(`/community/stories/user/${customerId}`));
  }

  createStory(payload: { media_url?: string; caption?: string }): Observable<{ status: string; story_id: string }> {
    return this.http.post<{ status: string; story_id: string }>(apiUrl('/community/stories'), payload);
  }

  uploadMedia(file: File): Observable<{ url: string; thumbnailUrl?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; thumbnailUrl?: string }>(apiUrl('/community/upload'), formData);
  }

  deleteStory(storyId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(apiUrl(`/community/stories/${storyId}`));
  }

  likeStory(storyId: string): Observable<{ liked: boolean; likes_count: number }> {
    return this.http.post<{ liked: boolean; likes_count: number }>(apiUrl(`/community/stories/${storyId}/like`), {});
  }

  /** Fire-and-forget from the caller's perspective — failures shouldn't block viewing a story. */
  recordView(storyId: string): Observable<{ status: string; views_count: number }> {
    return this.http.post<{ status: string; views_count: number }>(apiUrl(`/community/stories/${storyId}/view`), {}).pipe(
      catchError(() => of({ status: 'error', views_count: 0 }))
    );
  }

  getStoryViewers(storyId: string): Observable<StoryViewer[]> {
    return this.http.get<StoryViewer[]>(apiUrl(`/community/stories/${storyId}/viewers`));
  }
}
