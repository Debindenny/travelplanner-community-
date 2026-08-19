import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { FaqPageComponent } from './faq-page.component';
import { SeoService } from '../shared/services/seo.service';
import { CmsService } from '../shared/services/cms.service';

describe('FaqPageComponent', () => {
  let component: FaqPageComponent;
  let fixture: ComponentFixture<FaqPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;
  let cmsService: jasmine.SpyObj<CmsService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);
    cmsService = jasmine.createSpyObj('CmsService', ['getFaqs']);
    cmsService.getFaqs.and.returnValue(
      of([{ id: 'general', title: 'General', items: [{ id: 'q1', question: 'Q?', answer: 'A.' }] }]),
    );

    await TestBed.configureTestingModule({
      imports: [FaqPageComponent, TranslatePipe.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seoService },
        { provide: CmsService, useValue: cmsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata and FAQPage JSON-LD on init', () => {
    expect(seoService.set).toHaveBeenCalled();
    expect(seoService.setJsonLd).toHaveBeenCalled();
    const schema = seoService.setJsonLd.calls.mostRecent().args[0] as { '@type': string };
    expect(schema['@type']).toBe('FAQPage');
  });

  it('should render a bottom CTA linking to /contact', () => {
    const cta: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a[href^="/contact"]');
    expect(cta).toBeTruthy();
  });
});
