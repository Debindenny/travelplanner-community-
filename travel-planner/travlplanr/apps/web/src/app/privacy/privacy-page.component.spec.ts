import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PrivacyPageComponent } from './privacy-page.component';
import { SeoService } from '../shared/services/seo.service';
import { PRIVACY_SECTIONS } from '../shared/data/privacy.data';

describe('PrivacyPageComponent', () => {
  let component: PrivacyPageComponent;
  let fixture: ComponentFixture<PrivacyPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);

    await TestBed.configureTestingModule({
      imports: [PrivacyPageComponent, TranslatePipe.forRoot()],
      providers: [provideRouter([]), { provide: SeoService, useValue: seoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata on init', () => {
    expect(seoService.set).toHaveBeenCalled();
    const args = seoService.set.calls.mostRecent().args[0];
    expect(args.title).toContain('Privacy');
  });

  it('should render the privacy sections', () => {
    expect(component.sections()).toBe(PRIVACY_SECTIONS);
    expect(fixture.nativeElement.textContent).toContain(PRIVACY_SECTIONS[0].title);
  });
});
