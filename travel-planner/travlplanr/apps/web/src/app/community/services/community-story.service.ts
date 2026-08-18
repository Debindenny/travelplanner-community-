import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';

export interface Story {
  id: string;
  media_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
}

export interface StoryGroup {
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
  stories: Story[];
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

  createStory(payload: { media_url: string; caption?: string }): Observable<{ status: string; story_id: string }> {
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
}
