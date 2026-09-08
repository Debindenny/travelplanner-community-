import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface CreatePostPayload {
  caption: string;
  location?: string;
  destination_id?: string;
  images: string[];
  itinerary_id?: string;
  video_url?: string;
  is_reel?: boolean;
  /** 2+ option strings turn this into a poll post (type becomes 'poll'); the
      question is just `caption`, same as every other post type. */
  poll_options?: string[];
}

export interface CommunityPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface CommunityPoll {
  id: string;
  question: string;
  options: CommunityPollOption[];
  totalVotes: number;
  userVotedOptionId: string | null;
}

export interface CommunityPost {
  id: string;
  author: {
    id: string;
    name: string;
    avatar: string | null;
    is_verified?: boolean;
    countries_visited?: number;
    local_in?: string | null;
  };
  title?: string | null;
  tag?: string | null;
  category?: string | null;
  authorLine?: string | null;
  body?: string | null;
  usedLabel?: string | null;
  facts?: { label: string; value: string }[] | null;
  points?: string[] | null;
  useCount?: number | null;
  location?: string;
  destination?: {
    id: string;
    name: string;
    country: string;
    image_url: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  images: string[];
  caption: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  timeAgo: string;
  is_following?: boolean;
  video_url?: string | null;
  is_reel?: boolean;
  views_count?: number;
  isSaved?: boolean;
  saveCount?: number;
  reactions?: { [key: string]: number };
  userReaction?: string | null;
  itinerary_id?: string | null;
  itinerary?: {
    id: string;
    title: string;
    destination: string;
    days: any[];
    budget: string;
    image: string | null;
  } | null;
  hashtags?: string[];
  type?: string;
  poll?: CommunityPoll | null;
}

export interface CommunityTripTemplate {
  id: string;
  title: string;
  subtitle: string;
  tier: string;
  savesLabel: string;
  perPerson: string;
  updatedLabel: string;
  image: string;
  author: string;
  authorId: string;
  days: number;
  cities: number;
  activities: number;
  isSaved: boolean;
}

export interface TripTemplatePlace {
  title: string;
  image: string | null;
  timeOfDay: string;
  duration: string | null;
  refundable: string | null;
}

export interface TripTemplateDayCity {
  day: number;
  city: string;
  places: TripTemplatePlace[];
}

export interface TripTemplateDetail {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  days: number;
  dayCities: TripTemplateDayCity[];
}

@Injectable({
  providedIn: 'root'
})
export class CommunityPostService {
  constructor(private http: HttpClient) {}

  getFeed(limit: number = 20, cursor?: string): Observable<{ posts: CommunityPost[], nextCursor?: string }> {
    const url = cursor ? apiUrl(`/community/feed?limit=${limit}&cursor=${cursor}`) : apiUrl(`/community/feed?limit=${limit}`);
    return this.http.get<{ posts: CommunityPost[], nextCursor?: string }>(url);
  }

  getExploreFeed(limit: number = 20, cursor?: string): Observable<{ posts: CommunityPost[], nextCursor?: string }> {
    const url = cursor ? apiUrl(`/community/explore?limit=${limit}&cursor=${cursor}`) : apiUrl(`/community/explore?limit=${limit}`);
    return this.http.get<{ posts: CommunityPost[], nextCursor?: string }>(url);
  }

  getPostById(postId: string): Observable<CommunityPost> {
    return this.http.get<CommunityPost>(
      apiUrl(`/community/${postId}`)
    );
  }

  getPostsByHashtag(tag: string, limit: number = 20, cursor?: string): Observable<{ posts: CommunityPost[], nextCursor?: string }> {
    const url = cursor ? apiUrl(`/community/posts/hashtag/${tag}?limit=${limit}&cursor=${cursor}`) : apiUrl(`/community/posts/hashtag/${tag}?limit=${limit}`);
    return this.http.get<{ posts: CommunityPost[], nextCursor?: string }>(url);
  }

  createPost(data: CreatePostPayload): Observable<CommunityPost> {
    return this.http.post<CommunityPost>(
      apiUrl('/community'),
      data
    );
  }

  votePoll(postId: string, optionId: string): Observable<CommunityPoll> {
    return this.http.post<CommunityPoll>(
      apiUrl(`/community/${postId}/poll/vote`),
      { option_id: optionId }
    );
  }

  toggleLike(postId: string): Observable<{ status: string; action: string; likes_count: number }> {
    return this.http.post<any>(
      apiUrl(`/community/${postId}/like`),
      {}
    );
  }

  toggleReaction(postId: string, reactionType: string): Observable<{ status: string; action: string; reaction: string | null; likes_count: number; reactions: { [key: string]: number } }> {
    return this.http.post<any>(
      apiUrl(`/community/${postId}/react`),
      { reaction_type: reactionType }
    );
  }

  viewPost(postId: string): Observable<any> {
    return this.http.post(apiUrl(`/community/${postId}/view`), {});
  }

  toggleSave(postId: string): Observable<{ saved: boolean }> {
    return this.http.post<{ saved: boolean }>(
      apiUrl('/community/saved/toggle'),
      { item_type: 'post', item_id: postId }
    );
  }

  deletePost(postId: string): Observable<any> {
    return this.http.delete(apiUrl(`/community/${postId}`));
  }

  updatePost(postId: string, data: { caption?: string; location?: string }): Observable<CommunityPost> {
    return this.http.patch<CommunityPost>(apiUrl(`/community/${postId}`), data);
  }

  cloneTrip(tripId: string): Observable<{ tripId: string }> {
    return this.http.post<{ tripId: string }>(
      apiUrl(`/community/trips/${tripId}/clone`),
      {}
    );
  }

  getTripTemplates(): Observable<{ items: CommunityTripTemplate[] }> {
    return this.http.get<{ items: CommunityTripTemplate[] }>(apiUrl('/community/trips/templates'));
  }

  getTripTemplateDetail(tripId: string): Observable<TripTemplateDetail> {
    return this.http.get<TripTemplateDetail>(apiUrl(`/community/trips/templates/${tripId}`));
  }

  toggleSaveItinerary(tripId: string): Observable<{ saved: boolean }> {
    return this.http.post<{ saved: boolean }>(
      apiUrl('/community/saved/toggle'),
      { item_type: 'itinerary', item_id: tripId }
    );
  }

  uploadImage(file: File): Observable<{url: string; thumbnailUrl?: string}> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{url: string; thumbnailUrl?: string}>(apiUrl('/community/upload'), formData);
  }
}
