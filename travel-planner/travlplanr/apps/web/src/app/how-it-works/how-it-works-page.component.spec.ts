import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { HowItWorksPageComponent } from './how-it-works-page.component';
import { SeoService } from '../shared/services/seo.service';
import { CmsService } from '../shared/services/cms.service';

describe('HowItWorksPageComponent', () => {
  let component: HowItWorksPageComponent;
  let fixture: ComponentFixture<HowItWorksPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;
  let cmsService: jasmine.SpyObj<CmsService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);
    cmsService = jasmine.createSpyObj('CmsService', ['getFaqs']);
    cmsService.getFaqs.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [HowItWorksPageComponent, TranslatePipe.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seoService },
        { provide: CmsService, useValue: cmsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HowItWorksPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata on init', () => {
    expect(seoService.set).toHaveBeenCalled();
  });

  it('should point the primary CTAs at /wizard', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a[href="/wizard"]'),
    );
    expect(links.length).toBeGreaterThan(0);
  });
});
