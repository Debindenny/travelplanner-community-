import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../utils/api-url';
import { LocaleService } from '../../core/services/locale.service';

export interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  locale?: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  publishedAt: string;
  readTime: string;
  category: string;
  categoryLabel: string;
  featured: boolean;
  status: 'published' | 'draft';
  tags: string;
  metaTitle?: string;
  metaDescription?: string;
  targetKeywords?: string;
}

export interface FaqSectionData {
  id: string;
  title: string;
  locale?: string;
  items: FaqItemData[];
}

export interface FaqItemData {
  id: string;
  question: string;
  answer: string;
}

@Injectable({
  providedIn: 'root',
})
export class CmsService {
  private readonly http = inject(HttpClient);
  private readonly locale = inject(LocaleService);

  /** Current UI locale, sent to the backend so it can fall back to English when untranslated. */
  private localeParams(): HttpParams {
    return new HttpParams().set('locale', this.locale.currentLanguage());
  }

  getBlogPosts(): Observable<BlogPostData[]> {
    return this.http.get<BlogPostData[]>(apiUrl('/cms/blog'), { params: this.localeParams() });
  }

  getBlogPost(slug: string): Observable<BlogPostData> {
    return this.http.get<BlogPostData>(apiUrl(`/cms/blog/${slug}`), { params: this.localeParams() });
  }

  getFaqs(): Observable<FaqSectionData[]> {
    return this.http.get<FaqSectionData[]>(apiUrl('/cms/faq'), { params: this.localeParams() });
  }

  submitFaqFeedback(itemId: string, helpful: boolean): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(apiUrl(`/cms/faq/${itemId}/feedback`), { helpful });
  }
}
