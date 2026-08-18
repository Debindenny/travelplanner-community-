import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../shared/utils/api-url';

export interface Comment {
  id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
  customer_id: string;
}

export interface PaginatedCommentsResponse {
  comments: Comment[];
  total_count: number;
  has_more: boolean;
}

export interface CreateCommentPayload {
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityCommentService {
  constructor(private http: HttpClient) {}

  getComments(postId: string, limit: number = 10, offset: number = 0): Observable<PaginatedCommentsResponse> {
    return this.http.get<PaginatedCommentsResponse>(
      apiUrl(`/community/${postId}/comments?limit=${limit}&offset=${offset}`)
    );
  }

  createComment(postId: string, content: string): Observable<Comment> {
    return this.http.post<Comment>(
      apiUrl(`/community/${postId}/comments`),
      { content }
    );
  }

  deleteComment(postId: string, commentId: string): Observable<any> {
    return this.http.delete(
      apiUrl(`/community/${postId}/comments/${commentId}`)
    );
  }
}
