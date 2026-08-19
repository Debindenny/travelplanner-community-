import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { BlogPageComponent } from './blog-page.component';
import { SeoService } from '../shared/services/seo.service';
import { CmsService } from '../shared/services/cms.service';

describe('BlogPageComponent', () => {
  let component: BlogPageComponent;
  let fixture: ComponentFixture<BlogPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;
  let cmsService: jasmine.SpyObj<CmsService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);
    cmsService = jasmine.createSpyObj('CmsService', ['getBlogPosts']);
    cmsService.getBlogPosts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [BlogPageComponent, TranslatePipe.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seoService },
        { provide: CmsService, useValue: cmsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata from i18n keys on init', () => {
    expect(seoService.set).toHaveBeenCalled();
    const args = seoService.set.calls.mostRecent().args[0];
    expect(args.title).toBeTruthy();
    expect(args.description).toBeTruthy();
  });

  it('should load posts from CmsService', () => {
    expect(cmsService.getBlogPosts).toHaveBeenCalled();
  });
});
