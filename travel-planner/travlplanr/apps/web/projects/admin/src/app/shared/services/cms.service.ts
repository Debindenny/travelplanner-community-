import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Promotion {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_until: string;
  is_active: boolean;
}

export interface SupportTicket {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface Review {
  id: string;
  target_type: string;
  customer_name: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
}

export interface Destination {
  id: string;
  name: string;
  description: string;
  image_url: string;
  base_price: number;
  region: string;
  tags: string[];
}

export interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  locale: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  publishedAt: string;
  readTime: string;
  category: string;
  categoryLabel: string;
  featured: boolean;
  status: string;
  tags: string;
  metaTitle?: string;
  metaDescription?: string;
  targetKeywords?: string;
}

export interface UploadImageResponse {
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class CmsService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBaseUrl || '/api/v1';

  // --- Promotions ---
  getPromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(`${this.apiBase}/admin/promotions/`).pipe(catchError(() => of([])));
  }

  createPromotion(data: Partial<Promotion>): Observable<Promotion> {
    return this.http.post<Promotion>(`${this.apiBase}/admin/promotions/`, data);
  }

  updatePromotionStatus(id: string, is_active: boolean): Observable<Promotion> {
    return this.http.patch<Promotion>(`${this.apiBase}/admin/promotions/${id}`, { is_active });
  }

  deletePromotion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/admin/promotions/${id}`);
  }

  // --- Destinations ---
  getDestinations(): Observable<Destination[]> {
    return this.http.get<Destination[]>(`${this.apiBase}/admin/destinations/`).pipe(catchError(() => of([])));
  }

  createDestination(data: Partial<Destination>): Observable<Destination> {
    return this.http.post<Destination>(`${this.apiBase}/admin/destinations/`, data);
  }

  updateDestination(id: string, data: Partial<Destination>): Observable<Destination> {
    return this.http.patch<Destination>(`${this.apiBase}/admin/destinations/${id}`, data);
  }

  deleteDestination(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/admin/destinations/${id}`);
  }

  // --- Support ---
  getTickets(status?: string): Observable<SupportTicket[]> {
    const params: { [key: string]: string } = {};
    if (status) {
      params['status'] = status;
    }
    return this.http.get<SupportTicket[]>(`${this.apiBase}/admin/support/`, { params }).pipe(
      catchError(() => of<SupportTicket[]>([]))
    );
  }

  updateTicketStatus(id: string, status: string): Observable<SupportTicket> {
    return this.http.patch<SupportTicket>(`${this.apiBase}/admin/support/${id}`, { status });
  }

  // --- Reviews ---
  getReviews(status?: string): Observable<Review[]> {
    const params: { [key: string]: string } = {};
    if (status) {
      params['status'] = status;
    }
    return this.http.get<Review[]>(`${this.apiBase}/admin/reviews/`, { params }).pipe(
      catchError(() => of<Review[]>([]))
    );
  }

  updateReviewStatus(id: string, status: string): Observable<Review> {
    return this.http.patch<Review>(`${this.apiBase}/admin/reviews/${id}`, { status });
  }

  deleteReview(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/admin/reviews/${id}`);
  }

  // --- Blogs ---
  getBlogPosts(): Observable<BlogPostData[]> {
    return this.http.get<BlogPostData[]>(`${this.apiBase}/admin/blogs/`).pipe(catchError(() => of([])));
  }

  getBlogPost(slug: string, locale = 'en'): Observable<BlogPostData> {
    return this.http.get<BlogPostData>(`${this.apiBase}/admin/blogs/${slug}`, { params: { locale } });
  }

  createBlogPost(data: Partial<BlogPostData>): Observable<BlogPostData> {
    return this.http.post<BlogPostData>(`${this.apiBase}/admin/blogs/`, data);
  }

  updateBlogPost(slug: string, data: Partial<BlogPostData>, locale = 'en'): Observable<BlogPostData> {
    return this.http.patch<BlogPostData>(`${this.apiBase}/admin/blogs/${slug}`, data, { params: { locale } });
  }

  deleteBlogPost(slug: string, locale = 'en'): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/admin/blogs/${slug}`, { params: { locale } });
  }

  uploadImage(file: File): Observable<UploadImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadImageResponse>(`${this.apiBase}/admin/blogs/upload-image`, formData);
  }

  generateSEO(title: string, content: string): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/admin/blogs/generate-seo`, { title, content });
  }

  getMedia(): Observable<{url: string, name: string}[]> {
    return this.http.get<{url: string, name: string}[]>(`${this.apiBase}/admin/blogs/media`).pipe(catchError(() => of([])));
  }

  getRevisions(slug: string, locale = 'en'): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBase}/admin/blogs/${slug}/revisions`, { params: { locale } }).pipe(catchError(() => of([])));
  }
}
