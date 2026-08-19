import { Injectable, inject, DOCUMENT } from '@angular/core';

import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  ogImage?: string;
  canonicalUrl?: string;
  robots?: string;
}

/**
 * Sets per-page SEO metadata: <title>, meta description, and Open Graph /
 * Twitter card tags. Call from a public page component's ngOnInit.
 */
@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private static readonly DEFAULT_ORIGIN = 'https://travlplanr.com';
  private static readonly DEFAULT_OG_IMAGE = '/assets/images/landing/v2/ce82cf36c3f2b6058d1c9d2ed24cc222a0eeb540.png';

  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  // Single reused <script type="application/ld+json"> element in <head>.
  // Created lazily on first setJsonLd call, then its textContent is swapped
  // on every subsequent call so pages never accumulate duplicate blocks.
  private jsonLdEl: HTMLScriptElement | null = null;
  private canonicalEl: HTMLLinkElement | null = null;

  set({ title, description, ogImage, canonicalUrl, robots }: SeoData): void {
    const canonical = this.absoluteUrl(canonicalUrl ?? this.currentPath());
    const image = this.absoluteUrl(ogImage ?? SeoService.DEFAULT_OG_IMAGE);

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    this.meta.updateTag({ name: 'robots', content: robots ?? 'index, follow' });
    this.setCanonical(canonical);
  }

  /**
   * Inject (or update) a single schema.org JSON-LD block in the document head.
   * Pass one schema object or an array of them (emitted as a @graph). Calling
   * again replaces the previous payload rather than adding a second <script>.
   */
  setJsonLd(schema: object | object[]): void {
    const head = this.doc.head;
    if (!head) return;

    if (!this.jsonLdEl) {
      this.jsonLdEl = this.doc.createElement('script');
      this.jsonLdEl.type = 'application/ld+json';
      head.appendChild(this.jsonLdEl);
    }

    const payload = Array.isArray(schema)
      ? { '@context': 'https://schema.org', '@graph': schema }
      : { '@context': 'https://schema.org', ...(schema as Record<string, unknown>) };

    this.jsonLdEl.textContent = JSON.stringify(payload);
  }

  private setCanonical(url: string): void {
    const head = this.doc.head;
    if (!head) return;

    this.canonicalEl ??= head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!this.canonicalEl) {
      this.canonicalEl = this.doc.createElement('link');
      this.canonicalEl.rel = 'canonical';
      head.appendChild(this.canonicalEl);
    }
    this.canonicalEl.href = url;
  }

  private currentPath(): string {
    const location = this.doc.defaultView?.location;
    return location ? `${location.pathname}${location.search}` : '/';
  }

  private absoluteUrl(value: string): string {
    try {
      return new URL(value, this.doc.defaultView?.location?.origin ?? SeoService.DEFAULT_ORIGIN).toString();
    } catch {
      return new URL('/', SeoService.DEFAULT_ORIGIN).toString();
    }
  }
}
