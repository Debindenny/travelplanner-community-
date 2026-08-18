import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NgForm } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastService } from 'ui';
import { ContactPageComponent } from './contact-page.component';
import { ContactService } from './contact.service';
import { SeoService } from '../shared/services/seo.service';

describe('ContactPageComponent', () => {
  let component: ContactPageComponent;
  let fixture: ComponentFixture<ContactPageComponent>;
  let seoService: jasmine.SpyObj<SeoService>;
  let contactService: jasmine.SpyObj<ContactService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    seoService = jasmine.createSpyObj('SeoService', ['set', 'setJsonLd']);
    contactService = jasmine.createSpyObj('ContactService', ['submit']);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [ContactPageComponent, TranslatePipe.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SeoService, useValue: seoService },
        { provide: ContactService, useValue: contactService },
        { provide: ToastService, useValue: toastService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set SEO metadata on init', () => {
    expect(seoService.set).toHaveBeenCalled();
  });

  it('should show the ticket ID from the API response after a successful submit', async () => {
    contactService.submit.and.returnValue(Promise.resolve({ id: 'tix_123', status: 'received' }));
    component.form = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'General Inquiry',
      message: 'A' + 'a'.repeat(20),
    };
    const fakeForm = { form: { markAllAsTouched: () => {} }, invalid: false } as unknown as NgForm;

    await component.onSubmit(fakeForm);
    fixture.detectChanges();

    expect(component.submitted()).toBeTrue();
    expect(component.ticketId()).toBe('tix_123');
    expect(fixture.nativeElement.textContent).toContain('tix_123');
  });
});
