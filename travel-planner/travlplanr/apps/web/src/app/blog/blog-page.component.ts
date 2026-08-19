import { Component, OnInit, computed, effect, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { PrimaryButtonComponent } from 'ui';
import { SectionHeaderComponent } from '../shared/components/section-header/section-header.component';
import { SearchFieldComponent } from '../shared/components/search-field/search-field.component';
import { BlogCategory, BlogCategoryFilter, BlogPost } from '../shared/models/blog.models';
import { BlogPostCardComponent } from './components/blog-post-card/blog-post-card.component';
import { CmsService } from '../shared/services/cms.service';
import { SeoService } from '../shared/services/seo.service';
import { mapCmsPost } from '../shared/utils/blog-post-mapper';
import { PublicPageCtaComponent } from '../shared/components/public-page-cta/public-page-cta.component';
import { apiUrl } from '../shared/utils/api-url';

@Component({
    selector: 'app-blog-page',
    imports: [
        RouterLink,
        PublicPageShellComponent,
        SectionHeaderComponent,
        PrimaryButtonComponent,
        BlogPostCardComponent,
        SearchFieldComponent,
        PublicPageCtaComponent,
        TranslatePipe,
    ],
    template: `
    <app-public-page-shell variant="content" background="surface-muted">
        <section class="border-b border-border bg-white py-16">
          <div class="section-container">
            <app-section-header
              [title]="'BLOG.HERO.TITLE' | translate"
              [subtitle]="'BLOG.HERO.SUBTITLE' | translate"
              [watermark]="'BLOG.HERO.WATERMARK' | translate"
            />
          </div>
        </section>

        @if (featuredPost(); as featured) {
          <section class="section-container py-12">
            <article
              class="group relative grid overflow-hidden rounded-card border border-border bg-white lg:grid-cols-[1.1fr_1fr]"
            >
              <div class="block h-full min-h-[280px] overflow-hidden lg:min-h-[420px]">
                <img
                  [src]="featured.image"
                  [alt]="featured.title"
                  class="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  width="720"
                  height="420"
                  fetchpriority="high"
                />
              </div>
              <div class="flex flex-col justify-center gap-4 p-8 lg:p-12">
                <span class="inline-block w-fit rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary">
                  {{ 'BLOG.FEATURED_LABEL' | translate }} · {{ featured.categoryLabel }}
                </span>
                <a [routerLink]="['/blog', featured.slug]" class="no-underline after:absolute after:inset-0">
                  <h2 class="text-[clamp(1.75rem,3vw,32px)] font-bold leading-tight text-text-primary hover:text-primary">
                    {{ featured.title }}
                  </h2>
                </a>
                <p class="text-base leading-relaxed text-text-secondary">
                  {{ featured.excerpt }}
                </p>
                <div class="text-sm text-text-tertiary">
                  {{ featured.author }} · {{ featured.publishedAt }} · {{ featured.readTime }}
                </div>
                <span class="text-sm font-medium text-primary" aria-hidden="true">{{ 'BLOG.READ_ARTICLE' | translate }}</span>
              </div>
            </article>
          </section>
        }

        <section class="section-container pb-20">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap gap-3">
              @for (filter of filters(); track filter.id) {
                <button
                  type="button"
                  class="rounded-[30px] border px-5 py-2.5 text-sm transition-colors"
                  [class.border-primary]="activeFilter() === filter.id"
                  [class.bg-primary-50]="activeFilter() === filter.id"
                  [class.text-primary]="activeFilter() === filter.id"
                  [class.border-border]="activeFilter() !== filter.id"
                  [class.text-text-primary]="activeFilter() !== filter.id"
                  [attr.aria-pressed]="activeFilter() === filter.id"
                  (click)="setFilter(filter.id)"
                >
                  {{ filter.id === 'all' ? ('BLOG.FILTERS.ALL' | translate) : filter.label }}
                </button>
              }
            </div>

            <div class="flex w-full items-center gap-3 lg:w-auto">
              <app-search-field
                class="w-full lg:w-80"
                [value]="searchQuery()"
                (valueChange)="searchQuery.set($event)"
                [placeholder]="'BLOG.SEARCH_PLACEHOLDER' | translate"
                [ariaLabel]="'BLOG.SEARCH_PLACEHOLDER' | translate"
                variant="inline"
                size="md"
                prefixIcon="search"
                [debounceMs]="150"
              />
              <a
                [href]="rssUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-primary hover:text-primary"
                [attr.aria-label]="'BLOG.RSS_LINK' | translate"
                [title]="'BLOG.RSS_LINK' | translate"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 11a9 9 0 019 9" stroke-linecap="round" />
                  <path d="M4 4a16 16 0 0116 16" stroke-linecap="round" />
                  <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
            </div>
          </div>

          @if (loading()) {
            <div class="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3" role="status" [attr.aria-label]="'BLOG.LOADING_ARTICLES' | translate">
              @for (item of skeletonItems; track item) {
                <div class="overflow-hidden rounded-card border border-border bg-white" aria-hidden="true">
                  <div class="h-[220px] bg-border-light/70"></div>
                  <div class="space-y-4 p-6">
                    <div class="h-5 w-24 rounded-full bg-border-light/80"></div>
                    <div class="h-6 w-4/5 rounded-full bg-border-light/70"></div>
                    <div class="h-4 w-full rounded-full bg-border-light/60"></div>
                    <div class="h-4 w-2/3 rounded-full bg-border-light/60"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (error()) {
            <div class="mt-12 flex flex-col items-center rounded-card border border-dashed border-border bg-white p-12 text-center">
              <p class="text-xl font-semibold text-text-primary">{{ 'BLOG.ERROR.TITLE' | translate }}</p>
              <p class="mt-2 max-w-[480px] text-base text-text-secondary">{{ error()! | translate }}</p>
              <app-primary-button widthClass="mt-8" (click)="retry()">{{ 'BLOG.TRY_AGAIN' | translate }}</app-primary-button>
            </div>
          } @else if (filteredPosts().length === 0) {
            <div class="mt-12 rounded-card border border-dashed border-border bg-white p-12 text-center">
              <p class="text-xl font-semibold text-text-primary">{{ 'BLOG.EMPTY.TITLE' | translate }}</p>
              <p class="mt-2 text-base text-text-secondary">
                {{ 'BLOG.EMPTY.SUBTITLE' | translate }}
              </p>
            </div>
          } @else {
            <div class="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              @for (post of visiblePosts(); track post.slug) {
                <app-blog-post-card [post]="post" />
              }
            </div>
            @if (hasMore()) {
              <div class="mt-10 flex justify-center">
                <app-primary-button (click)="loadMore()">{{ 'BLOG.LOAD_MORE' | translate }}</app-primary-button>
              </div>
            }
          }
        </section>

        <app-public-page-cta />
    </app-public-page-shell>
  `
})
export class BlogPageComponent implements OnInit {
  // Must be a signal — filteredPosts() is a computed() and only reacts to
  // signal changes; a plain property mutated via ngModel silently froze the
  // search filter at its initial (empty) value.
  readonly searchQuery = signal('');
  readonly activeFilter = signal<BlogCategory | 'all'>('all');
  private readonly cms = inject(CmsService);
  private readonly seo = inject(SeoService);
  private readonly translate = inject(TranslateService);

  readonly allPosts = signal<BlogPost[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];
  readonly rssUrl = apiUrl('/cms/blog/rss.xml');

  private static readonly PAGE_SIZE = 9;
  readonly visibleCount = signal(BlogPageComponent.PAGE_SIZE);

  constructor() {
    this.load();
    // Reset pagination whenever the visible result set changes shape, so
    // switching filters/search doesn't leave "Load more" pointing at a
    // count that no longer lines up with the newly filtered list.
    effect(
      () => {
        this.searchQuery();
        this.activeFilter();
        this.visibleCount.set(BlogPageComponent.PAGE_SIZE);
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit(): void {
    this.seo.set({
      title: this.translate.instant('BLOG.SEO.TITLE'),
      description: this.translate.instant('BLOG.SEO.DESCRIPTION'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cms.getBlogPosts().subscribe({
      next: (posts) => {
        const mapped: BlogPost[] = posts.map((post) => mapCmsPost(post));
        this.allPosts.set(mapped);
        if (!this.filters().some((filter) => filter.id === this.activeFilter())) {
          this.activeFilter.set('all');
        }
        this.loading.set(false);
        this.emitCollectionJsonLd(mapped);
      },
      error: () => {
        this.error.set('BLOG.ERROR.LOAD_FAILED');
        this.loading.set(false);
      }
    });
  }

  retry(): void {
    this.load();
  }

  private emitCollectionJsonLd(posts: BlogPost[]): void {
    if (posts.length === 0) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://travlplanr.com';
    this.seo.setJsonLd({
      '@type': 'CollectionPage',
      name: this.translate.instant('BLOG.SEO.TITLE'),
      description: this.translate.instant('BLOG.SEO.DESCRIPTION'),
      mainEntity: {
        '@type': 'Blog',
        blogPost: posts.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          url: `${origin}/blog/${post.slug}`,
          image: post.image,
          datePublished: post.publishedAt,
        })),
      },
    });
  }

  readonly featuredPost = computed(() => this.allPosts().find((post) => post.featured));

  readonly filters = computed<BlogCategoryFilter[]>(() => {
    const categories = new Map<BlogCategory, string>();
    for (const post of this.allPosts()) {
      categories.set(post.category, post.categoryLabel);
    }
    return [
      { id: 'all', label: 'All' },
      ...Array.from(categories.entries()).map(([id, label]) => ({ id, label })),
    ];
  });

  readonly filteredPosts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeFilter();
    const isBrowsing = !query && category === 'all';
    const heroSlug = this.featuredPost()?.slug;

    return this.allPosts().filter((post) => {
      // Only hide the post currently shown as the hero, and only in the
      // default browse view — previously EVERY featured post was excluded
      // unconditionally, so a featured post's own title returned zero
      // search results and a second featured post became unreachable.
      if (isBrowsing && post.slug === heroSlug) return false;
      const matchesCategory = category === 'all' || post.category === category;
      const matchesQuery =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.categoryLabel.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  });

  readonly visiblePosts = computed(() => this.filteredPosts().slice(0, this.visibleCount()));
  readonly hasMore = computed(() => this.filteredPosts().length > this.visibleCount());

  loadMore(): void {
    this.visibleCount.update((count) => count + BlogPageComponent.PAGE_SIZE);
  }

  setFilter(filter: BlogCategory | 'all'): void {
    this.activeFilter.set(filter);
  }
}
