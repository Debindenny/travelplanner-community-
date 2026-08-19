import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CtaBannerSectionComponent } from '../landing/components/cta-banner-section/cta-banner-section.component';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { PrimaryButtonComponent } from 'ui';
import { BlogPost } from '../shared/models/blog.models';
import { CmsService } from '../shared/services/cms.service';
import { SeoService } from '../shared/services/seo.service';
import { mapCmsPost } from '../shared/utils/blog-post-mapper';
import { BlogRelatedPostsSectionComponent } from './components/blog-related-posts-section/blog-related-posts-section.component';

declare global {
  interface Window {
    hljs?: { highlightAll: () => void };
  }
}

@Component({
    selector: 'app-blog-post-page',
    imports: [
        RouterLink,
        PublicPageShellComponent,
        PrimaryButtonComponent,
        CtaBannerSectionComponent,
        BlogRelatedPostsSectionComponent,
        TranslatePipe,
    ],
    template: `
    <app-public-page-shell variant="content" background="surface-muted">
        @if (post(); as article) {
          <div class="fixed left-0 top-0 z-50 h-1 w-full bg-transparent" aria-hidden="true">
            <div class="h-full bg-primary transition-[width] duration-150 ease-out" [style.width.%]="readingProgress()"></div>
          </div>
          <article>
            <div class="border-b border-border bg-white py-8">
              <div class="section-container">
                <nav class="flex flex-wrap items-center gap-2 text-sm text-text-tertiary" [attr.aria-label]="'BLOG.BREADCRUMB.LABEL' | translate">
                  <a routerLink="/blog" class="text-text-secondary no-underline hover:text-primary">{{ 'BLOG.BREADCRUMB.BLOG' | translate }}</a>
                  <span aria-hidden="true">/</span>
                  <span class="text-text-secondary">{{ article.categoryLabel }}</span>
                  <span aria-hidden="true">/</span>
                  <span class="text-text-primary">{{ article.title }}</span>
                </nav>

                <div class="mt-8 max-w-[846px]">
                  <span class="inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary">
                    {{ article.categoryLabel }}
                  </span>
                  <h1 class="mt-4 text-[clamp(2rem,4vw,48px)] font-bold leading-tight text-text-primary">
                    {{ article.title }}
                  </h1>
                  <p class="mt-4 text-lg leading-relaxed text-text-secondary">
                    {{ article.excerpt }}
                  </p>

                  <div class="mt-6 flex flex-wrap items-center gap-4 border-b border-border pb-8">
                    <img
                      [src]="authorAvatar(article.author)"
                      [alt]="article.author"
                      class="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <p class="text-base font-medium text-text-primary">{{ article.author }}</p>
                      <p class="text-sm text-text-tertiary">
                        {{ article.publishedAt }} ·
                        {{ readingTimeMinutes() !== null
                          ? ('BLOG.READ_TIME_MINUTES' | translate: { minutes: readingTimeMinutes() })
                          : article.readTime }}
                      </p>
                    </div>
                  </div>
                  @if (parseTags(article.tags).length > 0) {
                    <div class="mt-4 flex flex-wrap gap-2">
                      @for (tag of parseTags(article.tags); track tag) {
                        <span class="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-text-secondary">
                          #{{ tag }}
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="section-container py-10">
              <div class="overflow-hidden rounded-card">
                <img
                  [src]="article.image"
                  [alt]="article.title"
                  class="h-[280px] w-full object-cover sm:h-[360px] lg:h-[480px]"
                  width="1280"
                  height="480"
                  fetchpriority="high"
                />
              </div>

              <div class="mx-auto mt-10 max-w-[846px]">
                @if (toc().length > 0) {
                  <nav class="mb-8 rounded-card border border-border bg-white p-6" [attr.aria-label]="'BLOG.TOC_HEADING' | translate">
                    <h2 class="text-sm font-semibold uppercase tracking-wide text-text-tertiary">{{ 'BLOG.TOC_HEADING' | translate }}</h2>
                    <ul class="mt-3 space-y-2">
                      @for (item of toc(); track item.id) {
                        <li [class.ml-4]="item.level === 3">
                          <a [href]="'#' + item.id" class="text-sm text-text-secondary no-underline hover:text-primary hover:underline">{{ item.text }}</a>
                        </li>
                      }
                    </ul>
                  </nav>
                }
                <div class="space-y-6 prose prose-lg max-w-none text-text-secondary" [innerHTML]="article.content">
                </div>

                <div class="mt-12 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-medium text-text-primary">{{ 'BLOG.SHARE.TITLE' | translate }}</p>
                    <div class="mt-3 flex gap-4">
                      @for (share of shareLinks(); track share.label) {
                        <a
                          [href]="share.href"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white transition-colors hover:border-primary"
                          [attr.aria-label]="'BLOG.SHARE.ON_NETWORK' | translate: { network: share.label }"
                        >
                          <img [src]="share.icon" [alt]="''" class="h-4 w-4" />
                        </a>
                      }
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-3">
                    <app-primary-button routerLink="/explore" widthClass="!h-11 !px-5">
                      {{ 'BLOG.PLAN_TRIP_LIKE_THIS' | translate }}
                    </app-primary-button>
                    <a
                      routerLink="/blog"
                      class="inline-flex h-11 items-center rounded-btn border border-border bg-white px-5 text-base font-medium text-text-primary no-underline transition-colors hover:border-primary hover:text-primary"
                    >
                      {{ 'BLOG.BACK_TO_BLOG' | translate }}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            @if (relatedPosts().length > 0) {
              <app-blog-related-posts-section [posts]="relatedPosts()" />
            }

            <app-cta-banner-section />
          </article>
        } @else if (loading()) {
          <div class="section-container py-10" role="status" [attr.aria-label]="'BLOG.LOADING_ARTICLE' | translate">
            <div class="mx-auto max-w-[846px] space-y-6">
              <div class="h-5 w-32 rounded-full bg-border-light/80"></div>
              <div class="h-12 w-4/5 rounded-full bg-border-light/70"></div>
              <div class="h-5 w-full rounded-full bg-border-light/60"></div>
              <div class="h-5 w-2/3 rounded-full bg-border-light/60"></div>
              <div class="h-[280px] rounded-card bg-border-light/70 sm:h-[360px] lg:h-[480px]"></div>
              <div class="space-y-3">
                @for (item of skeletonLines; track item) {
                  <div [class]="item % 3 === 0 ? 'h-4 w-5/6 rounded-full bg-border-light/60' : 'h-4 w-full rounded-full bg-border-light/60'"></div>
                }
              </div>
            </div>
          </div>
        } @else if (loadError()) {
          <div class="section-container py-20 text-center">
            <h1 class="text-7xl font-bold text-text-primary">{{ 'BLOG.POST_ERROR.LOAD_FAILED_TITLE' | translate }}</h1>
            <p class="mt-3 text-lg text-text-secondary">{{ loadError()! | translate }}</p>
            <app-primary-button widthClass="mt-8" (click)="retry()">
              {{ 'BLOG.TRY_AGAIN' | translate }}
            </app-primary-button>
          </div>
        } @else {
          <div class="section-container py-20 text-center">
            <h1 class="text-7xl font-bold text-text-primary">{{ 'BLOG.POST_ERROR.NOT_FOUND_TITLE' | translate }}</h1>
            <p class="mt-3 text-lg text-text-secondary">
              {{ 'BLOG.POST_ERROR.NOT_FOUND_SUBTITLE' | translate }}
            </p>
            <app-primary-button routerLink="/blog" widthClass="mt-8">
              {{ 'BLOG.BROWSE_ALL_ARTICLES' | translate }}
            </app-primary-button>
          </div>
        }
    </app-public-page-shell>
  `
})
export class BlogPostPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cms = inject(CmsService);
  private readonly seo = inject(SeoService);

  readonly post = signal<BlogPost | null>(null);
  readonly relatedPosts = signal<BlogPost[]>([]);
  readonly loading = signal(true);
  // Set only when the article fails to load for a reason OTHER than a genuine
  // 404, so the template can distinguish "failed to load" (retry) from
  // "not found" (browse articles).
  readonly loadError = signal<string | null>(null);
  readonly skeletonLines = [1, 2, 3, 4, 5, 6];
  readonly toc = signal<{ id: string; text: string; level: 2 | 3 }[]>([]);
  readonly readingTimeMinutes = signal<number | null>(null);
  readonly readingProgress = signal(0);
  private currentSlug = '';

  @HostListener('window:scroll')
  onScroll(): void {
    if (typeof window === 'undefined' || !this.post()) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    this.readingProgress.set(Math.min(100, Math.max(0, progress)));
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.loadPost(params.get('slug') ?? '');
    });
  }

  ngOnInit(): void {
    this.seo.set({
      title: 'Article — Travl Planr',
      description:
        'Read travel stories, destination guides, and planning tips from the Travl Planr team.',
    });
  }

  retry(): void {
    this.loadPost(this.currentSlug);
  }

  private loadPost(slug: string): void {
    this.currentSlug = slug;
    this.loading.set(true);
    this.loadError.set(null);
    this.post.set(null);
    this.readingProgress.set(0);
    this.cms.getBlogPost(slug).subscribe({
      next: (p) => {
        // Guard against a late response from a slug the user has since
        // navigated away from overwriting the currently-displayed article.
        if (this.currentSlug !== slug) return;
        const { html, toc, readingTimeMinutes } = analyzeContent(sanitizeHtml(p.content));
        this.toc.set(toc);
        this.readingTimeMinutes.set(readingTimeMinutes);
        const mapped = mapCmsPost(p);
        mapped.content = html;
        this.post.set(mapped);
        this.seo.set({
          title: p.metaTitle ? `${p.metaTitle} — Travl Planr` : `${p.title} — Travl Planr`,
          description: p.metaDescription || p.excerpt,
          ogImage: p.image,
        });
        this.seo.setJsonLd({
          '@type': 'BlogPosting',
          headline: p.title,
          description: p.excerpt,
          image: p.image,
          datePublished: p.publishedAt,
          author: {
            '@type': 'Person',
            name: p.author,
          },
          publisher: {
            '@type': 'Organization',
            name: 'Travl Planr',
          },
          articleSection: p.categoryLabel,
        });
        this.loading.set(false);
        setTimeout(() => this.highlightCodeBlocks());
      },
      error: (err) => {
        if (this.currentSlug !== slug) return;
        this.post.set(null);
        // A 404 is a genuine "not found"; anything else is a load failure the
        // user should be able to retry.
        if (err?.status !== 404) {
          this.loadError.set('BLOG.POST_ERROR.LOAD_FAILED_MESSAGE');
        }
        this.loading.set(false);
      },
    });
    this.cms.getBlogPosts().subscribe({
      next: (posts) => {
        if (this.currentSlug !== slug) return;
        const current = posts.find((p) => p.slug === slug);
        const others = posts.filter((p) => p.slug !== slug);
        // Prefer posts sharing the current article's category — falls back
        // to any other post once same-category matches run out, instead of
        // pure array order with no relevance signal at all.
        const sameCategory = current
          ? others.filter((p) => p.category === current.category)
          : [];
        const rest = others.filter((p) => !sameCategory.includes(p));
        this.relatedPosts.set(
          [...sameCategory, ...rest]
            .slice(0, 4)
            .map((post) => mapCmsPost(post)),
        );
      },
    });
  }

  // There's no authorAvatar field in the blog model/backend — generate a
  // deterministic initials avatar per author instead of showing the exact
  // same generic image for every single author on every post.
  private static readonly AVATAR_COLORS = ['#2563EB', '#9333EA', '#16A34A', '#E11D48', '#D97706', '#0EA5E9'];

  authorAvatar(name: string): string {
    const trimmed = (name || '').trim();
    const initials = trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?';
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
    }
    const color = BlogPostPageComponent.AVATAR_COLORS[hash % BlogPostPageComponent.AVATAR_COLORS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="48" y="48" dy=".35em" text-anchor="middle" font-family="Poppins,sans-serif" font-size="36" fill="#fff">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // "Share this article" previously reused SOCIAL_LINKS (the company's own
  // follow-us profiles) — clicking "Share on Twitter" just opened the
  // company's Twitter profile instead of sharing the current article.
  readonly shareLinks = () => {
    const article = this.post();
    if (!article || typeof window === 'undefined') return [];
    const url = window.location.href;
    const title = article.title;
    return [
      {
        label: 'X',
        icon: 'assets/images/social/x-twitter.svg',
        href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      },
      {
        label: 'Facebook',
        icon: 'assets/images/social/facebook.svg',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      },
      {
        label: 'LinkedIn',
        icon: 'assets/images/social/linkedin.svg',
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      },
      {
        label: 'WhatsApp',
        icon: 'assets/images/footer/whatsapp.svg',
        href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      },
    ];
  };

  parseTags(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
    } catch {
      return raw.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  private highlightCodeBlocks(): void {
    if (typeof window === 'undefined') return;
    window.hljs?.highlightAll();
  }
}

const WORDS_PER_MINUTE = 200;

function analyzeContent(html: string): {
  html: string;
  toc: { id: string; text: string; level: 2 | 3 }[];
  readingTimeMinutes: number | null;
} {
  if (!html || typeof DOMParser === 'undefined') return { html, toc: [], readingTimeMinutes: null };

  const doc = new DOMParser().parseFromString(html, 'text/html');

  const usedIds = new Set<string>();
  const toc = Array.from(doc.body.querySelectorAll('h2, h3')).flatMap((heading) => {
    const text = heading.textContent?.trim() ?? '';
    if (!text) return [];
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    let id = base;
    let suffix = 1;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    heading.id = id;
    return [{ id, text, level: (heading.tagName === 'H2' ? 2 : 3) as 2 | 3 }];
  });

  const wordCount = (doc.body.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)) : null;

  return { html: doc.body.innerHTML, toc, readingTimeMinutes };
}

function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const allElements = doc.body.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'script' || tagName === 'iframe' || tagName === 'object' || tagName === 'embed' || tagName === 'link' || tagName === 'meta' || tagName === 'style') {
        el.parentNode?.removeChild(el);
        continue;
      }
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        const attrVal = attr.value.toLowerCase().trim();
        if (attrName.startsWith('on') || attrVal.startsWith('javascript:') || attrVal.startsWith('data:') || attrName === 'formaction') {
          el.removeAttribute(attr.name);
        }
      }
    }
    return doc.body.innerHTML;
  } catch (e) {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
}
