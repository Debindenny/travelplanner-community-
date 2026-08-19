import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TermsPageComponent } from './terms-page.component';
import { SeoService } from '../shared/services/seo.service';
import { TERMS_SECTIONS } from '../shared/data/terms.data';

describe('TermsPageComponent', () => {
  let component: TermsPageComponent;
  let fixture: ComponentFixture<TermsPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);

    await TestBed.configureTestingModule({
      imports: [TermsPageComponent, TranslatePipe.forRoot()],
      providers: [provideRouter([]), { provide: SeoService, useValue: seoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata on init', () => {
    expect(seoService.set).toHaveBeenCalled();
    const args = seoService.set.calls.mostRecent().args[0];
    expect(args.title).toContain('Terms');
  });

  it('should render the terms sections', () => {
    expect(component.sections()).toBe(TERMS_SECTIONS);
    expect(fixture.nativeElement.textContent).toContain(TERMS_SECTIONS[0].title);
  });
});
