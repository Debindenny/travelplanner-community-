import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutPageComponent } from './about-page.component';
import { TranslatePipe } from '@ngx-translate/core';
import { SeoService } from '../shared/services/seo.service';
import { provideRouter } from '@angular/router';

describe('AboutPageComponent', () => {
  let component: AboutPageComponent;
  let fixture: ComponentFixture<AboutPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);

    await TestBed.configureTestingModule({
      imports: [AboutPageComponent, TranslatePipe.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seoService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata on init', () => {
    expect(seoService.set).toHaveBeenCalled();
    const args = seoService.set.calls.mostRecent().args[0];
    expect(args.title).toContain('About Us');
    expect(args.ogImage).toBeTruthy();
  });

  it('should set Organization JSON-LD via SeoService', () => {
    expect(seoService.setJsonLd).toHaveBeenCalled();
    const schema = seoService.setJsonLd.calls.mostRecent().args[0] as { '@type': string; name: string };
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('TRAVL PLANR');
  });
});
