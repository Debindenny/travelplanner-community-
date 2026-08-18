import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { BlogPostPageComponent } from './blog-post-page.component';
import { SeoService } from '../shared/services/seo.service';
import { CmsService, BlogPostData } from '../shared/services/cms.service';

const MOCK_POST: BlogPostData = {
  id: '1',
  title: 'Test Post',
  slug: 'test-post',
  excerpt: 'A test excerpt',
  content: '<p>Test content</p>',
  image: '/test.jpg',
  author: 'Travl Planr',
  publishedAt: '2026-01-01',
  readTime: '5 min',
  category: 'guides',
  categoryLabel: 'Guides',
  featured: false,
  status: 'published',
  tags: 'test',
};

describe('BlogPostPageComponent', () => {
  let component: BlogPostPageComponent;
  let fixture: ComponentFixture<BlogPostPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;
  let cmsService: jasmine.SpyObj<CmsService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);
    cmsService = jasmine.createSpyObj('CmsService', ['getBlogPost', 'getBlogPosts']);
    cmsService.getBlogPost.and.returnValue(of(MOCK_POST));
    cmsService.getBlogPosts.and.returnValue(of([MOCK_POST]));

    await TestBed.configureTestingModule({
      imports: [BlogPostPageComponent, TranslatePipe.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seoService },
        { provide: CmsService, useValue: cmsService },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: 'test-post' })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPostPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the post for the routed slug', () => {
    expect(cmsService.getBlogPost).toHaveBeenCalledWith('test-post');
    expect(component.post()?.title).toBe('Test Post');
  });

  it('should set per-post SEO and BlogPosting JSON-LD', () => {
    expect(seoService.set).toHaveBeenCalled();
    expect(seoService.setJsonLd).toHaveBeenCalled();
    const schema = seoService.setJsonLd.calls.mostRecent().args[0] as { '@type': string };
    expect(schema['@type']).toBe('BlogPosting');
  });
});
