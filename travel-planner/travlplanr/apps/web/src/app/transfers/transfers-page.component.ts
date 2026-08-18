import { Component, OnDestroy, inject, signal, computed } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  PrimaryButtonComponent,
  JourneyCardComponent,
  EmptyStateComponent,
  StatusPillComponent,
} from 'ui';
import { FooterSectionComponent } from '../landing/components/footer-section/footer-section.component';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../shared/utils/toast.service';
import { apiErrorMessage } from '../shared/utils/api-error.util';
import {
  TransferService,
  TransferDestination,
  TransferProduct,
  TransferBookingResponse,
} from './transfer.service';

type WizardStep = 'search' | 'booking' | 'confirmation';
type ActiveField = 'pickup' | 'dropoff' | null;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

@Component({
    selector: 'app-transfers-page',
    imports: [
    ReactiveFormsModule,
    RouterLink,
    PrimaryButtonComponent,
    JourneyCardComponent,
    EmptyStateComponent,
    StatusPillComponent,
    FooterSectionComponent
],
    template: `
    <div class="bg-surface-muted min-h-screen pt-4">
      <div class="page-container px-5 xl:px-20 pb-20">

        <div class="mb-8">
          <h1 class="text-4xl md:text-6xl font-bold text-text-primary mb-1">Airport &amp; City Transfers</h1>
          <p class="text-base text-text-secondary">Book a private taxi or transfer, door to door — search live availability and pricing.</p>
        </div>

        @if (step() === 'search') {
          <!-- ============================= SEARCH FORM ============================= -->
          <section class="bg-white rounded-xl border border-border shadow-sm p-6 mb-8">
            <form [formGroup]="searchForm" (ngSubmit)="doSearch()" class="space-y-5">

              <div class="flex gap-2">
                <button type="button" class="px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors"
                        [class.bg-primary]="searchForm.value.journeyType === 'OneWay'"
                        [class.text-white]="searchForm.value.journeyType === 'OneWay'"
                        [class.border-primary]="searchForm.value.journeyType === 'OneWay'"
                        [class.border-border]="searchForm.value.journeyType !== 'OneWay'"
                        [class.text-text-secondary]="searchForm.value.journeyType !== 'OneWay'"
                        (click)="searchForm.patchValue({ journeyType: 'OneWay' })">
                  One way
                </button>
                <button type="button" class="px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors"
                        [class.bg-primary]="searchForm.value.journeyType === 'Return'"
                        [class.text-white]="searchForm.value.journeyType === 'Return'"
                        [class.border-primary]="searchForm.value.journeyType === 'Return'"
                        [class.border-border]="searchForm.value.journeyType !== 'Return'"
                        [class.text-text-secondary]="searchForm.value.journeyType !== 'Return'"
                        (click)="searchForm.patchValue({ journeyType: 'Return' })">
                  Return
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <!-- Pickup -->
                <div class="relative">
                  <label class="data-label block mb-1">Pickup location</label>
                  <input
                    type="text"
                    formControlName="pickupLocation"
                    placeholder="Airport, hotel, or address"
                    autocomplete="off"
                    class="w-full rounded-lg border border-border px-4 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    (input)="onLocationInput('pickup', $event)"
                    (focus)="activeField.set('pickup')"
                  />
                  @if (!pickupCode() && searchForm.value.pickupLocation) {
                    <p class="text-[11px] text-amber-600 mt-1">Pick a suggestion from the list to select a valid location.</p>
                  }
                  @if (activeField() === 'pickup' && pickupSuggestions().length) {
                    <div class="fixed inset-0 z-20" (click)="activeField.set(null)"></div>
                    <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-30 max-h-64 overflow-auto">
                      @for (dest of pickupSuggestions(); track $index) {
                        <button type="button" class="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-muted transition-colors"
                                (click)="selectSuggestion('pickup', dest)">
                          {{ describeDestination(dest) }}
                        </button>
                      }
                    </div>
                  }
                </div>

                <!-- Dropoff -->
                <div class="relative">
                  <label class="data-label block mb-1">Dropoff location</label>
                  <input
                    type="text"
                    formControlName="dropoffLocation"
                    placeholder="Airport, hotel, or address"
                    autocomplete="off"
                    class="w-full rounded-lg border border-border px-4 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    (input)="onLocationInput('dropoff', $event)"
                    (focus)="activeField.set('dropoff')"
                  />
                  @if (!dropoffCode() && searchForm.value.dropoffLocation) {
                    <p class="text-[11px] text-amber-600 mt-1">Pick a suggestion from the list to select a valid location.</p>
                  }
                  @if (activeField() === 'dropoff' && dropoffSuggestions().length) {
                    <div class="fixed inset-0 z-20" (click)="activeField.set(null)"></div>
                    <div class="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-30 max-h-64 overflow-auto">
                      @for (dest of dropoffSuggestions(); track $index) {
                        <button type="button" class="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-muted transition-colors"
                                (click)="selectSuggestion('dropoff', dest)">
                          {{ describeDestination(dest) }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <label class="data-label block mb-1">Arrival date</label>
                  <input type="date" formControlName="arrivalDate" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label class="data-label block mb-1">Arrival time</label>
                  <input type="time" formControlName="arrivalTime" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                @if (searchForm.value.journeyType === 'Return') {
                  <div>
                    <label class="data-label block mb-1">Return date</label>
                    <input type="date" formControlName="departureDate" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                  </div>
                  <div>
                    <label class="data-label block mb-1">Return time</label>
                    <input type="time" formControlName="departureTime" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                  </div>
                }
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <label class="data-label block mb-1">Adults</label>
                  <input type="number" min="1" formControlName="adults" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label class="data-label block mb-1">Children</label>
                  <input type="number" min="0" formControlName="children" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label class="data-label block mb-1">Infants</label>
                  <input type="number" min="0" formControlName="infants" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label class="data-label block mb-1">Currency</label>
                  <select formControlName="currency" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary">
                    @for (c of currencies; track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                </div>
              </div>

              @if (searchError()) {
                <div class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{{ searchError() }}</div>
              }

              <app-primary-button type="submit" [disabled]="searchForm.invalid || isSearching() || !pickupCode() || !dropoffCode()" [loading]="isSearching()">
                {{ isSearching() ? 'Searching…' : 'Search transfers' }}
              </app-primary-button>
            </form>
          </section>

          <!-- ============================= RESULTS ============================= -->
          @if (isSearching()) {
            <div class="py-24 text-center text-text-secondary">Searching for available transfers…</div>
          } @else if (hasSearched() && !searchError() && products().length === 0) {
            <app-empty-state icon="search" title="No transfers found" subtitle="Try a different pickup/dropoff location or date." />
          } @else if (products().length > 0) {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (product of products(); track $index) {
                <app-journey-card [hasImage]="!!product.general?.image" [interactive]="true">
                  @if (product.general?.image) {
                    <img journeyCardImage [src]="product.general?.image" [alt]="product.general?.productName || 'Vehicle'" class="w-full h-full object-cover" />
                  }
                  <div journeyCardHeader class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="text-base font-bold text-text-primary">{{ product.general?.productName || product.general?.vehicleType || 'Transfer vehicle' }}</h3>
                      <p class="text-xs text-text-tertiary">{{ product.general?.supplierName || 'Unknown operator' }}</p>
                    </div>
                    @if (product.general?.vehicleClass) {
                      <app-status-pill [label]="product.general!.vehicleClass!" variant="info" />
                    }
                  </div>
                  <div journeyCardBody class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                    @if (product.general?.maxPassengers) {
                      <span>👤 {{ product.general?.maxPassengers }} passengers</span>
                    }
                    @if (product.general?.maxLuggage) {
                      <span>🧳 {{ product.general?.maxLuggage }} bags</span>
                    }
                    @if (product.general?.duration) {
                      <span>⏱ {{ product.general?.duration }}</span>
                    }
                    @if (product.general?.distance) {
                      <span>📍 {{ product.general?.distance }}</span>
                    }
                    @if (product.general?.description) {
                      <p class="w-full text-text-tertiary mt-1">{{ product.general?.description }}</p>
                    }
                  </div>
                  <div journeyCardFooter class="flex items-center justify-between pt-2 border-t border-border mt-2">
                    <div>
                      <div class="text-xl font-bold text-primary">{{ product.pricing?.totalPrice }} {{ product.pricing?.currency }}</div>
                      @if (product.general?.cancellationPolicy) {
                        <div class="text-[11px] text-text-tertiary">{{ product.general?.cancellationPolicy }}</div>
                      }
                    </div>
                    <app-primary-button (click)="selectProduct(product)">Select</app-primary-button>
                  </div>
                </app-journey-card>
              }
            </div>
          }
        }

        @if (step() === 'booking' && selectedProduct(); as p) {
          <!-- ============================= BOOKING FORM ============================= -->
          <section class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 bg-white rounded-xl border border-border shadow-sm p-6">
              <button type="button" class="text-sm text-text-secondary hover:text-primary mb-4 inline-flex items-center gap-1" (click)="backToResults()">
                ← Back to results
              </button>
              <h2 class="text-xl font-bold text-text-primary mb-4">Passenger &amp; booking details</h2>

              <form [formGroup]="bookingForm" (ngSubmit)="submitBooking()" class="space-y-6">
                <div>
                  <h3 class="text-sm font-semibold text-text-primary mb-3">Lead passenger</h3>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select formControlName="leadTitle" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus">
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                    </select>
                    <input type="text" formControlName="firstName" placeholder="First name" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                    <input type="text" formControlName="lastName" placeholder="Last name" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <input type="tel" formControlName="phone" placeholder="Phone" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                    <input type="email" formControlName="email" placeholder="Email" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <input type="text" formControlName="address01" placeholder="Address line 1" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus md:col-span-2" />
                    <input type="text" formControlName="zipCode" placeholder="ZIP / postal code" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                  </div>
                  <input type="text" formControlName="address02" placeholder="Address line 2 (optional)" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus mt-4" />
                </div>

                <div>
                  <h3 class="text-sm font-semibold text-text-primary mb-3">Accommodation</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" formControlName="accomodationName" placeholder="Hotel / accommodation name" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                    <input type="text" formControlName="accomodationAddress01" placeholder="Accommodation address" class="rounded-lg border border-border px-3 py-2.5 text-sm-plus" />
                  </div>
                  <input type="text" formControlName="accomodationAddress02" placeholder="Address line 2 (optional)" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus mt-4" />
                </div>

                <div>
                  <h3 class="text-sm font-semibold text-text-primary mb-3">Notes (optional)</h3>
                  <textarea formControlName="remark" rows="3" placeholder="Flight number, special requests, etc." class="w-full rounded-lg border border-border px-3 py-2.5 text-sm-plus"></textarea>
                </div>

                @if (bookingError()) {
                  <div class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{{ bookingError() }}</div>
                }

                <app-primary-button type="submit" widthClass="w-full" [disabled]="bookingForm.invalid || isBooking()" [loading]="isBooking()">
                  {{ isBooking() ? 'Confirming booking…' : 'Confirm booking' }}
                </app-primary-button>
              </form>
            </div>

            <aside class="lg:col-span-1">
              <div class="bg-white rounded-xl border border-border shadow-sm p-6 lg:sticky lg:top-[88px]">
                <h3 class="text-sm font-semibold text-text-tertiary mb-2">Your selection</h3>
                <div class="text-lg font-bold text-text-primary">{{ p.general?.productName || p.general?.vehicleType }}</div>
                <div class="text-xs text-text-secondary mb-4">{{ p.general?.supplierName }}</div>
                <div class="text-3xl font-bold text-primary mb-1">{{ p.pricing?.totalPrice }} {{ p.pricing?.currency }}</div>
                <div class="text-xs text-text-tertiary">{{ searchForm.value.pickupLocation }} → {{ searchForm.value.dropoffLocation }}</div>
              </div>
            </aside>
          </section>
        }

        @if (step() === 'confirmation') {
          <!-- ============================= CONFIRMATION ============================= -->
          <section class="bg-white rounded-xl border border-border shadow-sm p-10 text-center max-w-xl mx-auto">
            @if (bookingResult(); as res) {
              <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-success dark:text-success/90" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h2 class="text-2xl font-bold text-text-primary mb-1">Transfer booked</h2>
              <p class="text-sm text-text-secondary mb-1">Status: {{ res.status || 'Confirmed' }}</p>
              @if (res.confirmationNumber) {
                <p class="text-sm text-text-secondary mb-4">Confirmation #: <span class="font-semibold text-text-primary">{{ res.confirmationNumber }}</span></p>
              }
              @if (res.transferDescription?.supplierName) {
                <p class="text-xs text-text-tertiary mb-6">Operated by {{ res.transferDescription?.supplierName }}</p>
              }
              <app-primary-button [routerLink]="['/trips']">View my trips</app-primary-button>
              <button type="button" class="block mx-auto mt-3 text-sm text-text-secondary hover:text-primary" (click)="startOver()">Book another transfer</button>
            }
          </section>
        }

      </div>
      <app-footer-section />
    </div>
  `
})
export class TransfersPageComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly transferService = inject(TransferService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly currencies = CURRENCIES;
  readonly step = signal<WizardStep>('search');
  readonly activeField = signal<ActiveField>(null);

  readonly isSearching = signal(false);
  readonly hasSearched = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly sessionId = signal<string | null>(null);
  readonly products = signal<TransferProduct[]>([]);

  readonly pickupSuggestions = signal<TransferDestination[]>([]);
  readonly dropoffSuggestions = signal<TransferDestination[]>([]);

  // TravelNext's real search API rejects free-text pickup/dropoff locations —
  // it expects the `locationCode` returned by /destinations. These track the
  // code behind whatever the user has typed; they're cleared whenever the
  // text is edited so a stale code can't be sent for a location that no
  // longer matches what's displayed.
  readonly pickupCode = signal<string | null>(null);
  readonly dropoffCode = signal<string | null>(null);

  readonly selectedProduct = signal<TransferProduct | null>(null);
  readonly isBooking = signal(false);
  readonly bookingError = signal<string | null>(null);
  readonly bookingResult = signal<TransferBookingResponse | null>(null);

  private pickupDebounce: ReturnType<typeof setTimeout> | null = null;
  private dropoffDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly searchForm = this.fb.nonNullable.group({
    journeyType: ['OneWay' as 'OneWay' | 'Return'],
    pickupLocation: ['', Validators.required],
    dropoffLocation: ['', Validators.required],
    arrivalDate: ['', Validators.required],
    arrivalTime: ['', Validators.required],
    departureDate: [''],
    departureTime: [''],
    adults: [2, [Validators.required, Validators.min(1)]],
    children: [0, [Validators.min(0)]],
    infants: [0, [Validators.min(0)]],
    currency: ['USD'],
  });

  readonly bookingForm = this.fb.nonNullable.group({
    leadTitle: ['Mr', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address01: ['', Validators.required],
    zipCode: ['', Validators.required],
    address02: [''],
    accomodationName: ['', Validators.required],
    accomodationAddress01: ['', Validators.required],
    accomodationAddress02: [''],
    remark: [''],
  });

  ngOnDestroy(): void {
    if (this.pickupDebounce) clearTimeout(this.pickupDebounce);
    if (this.dropoffDebounce) clearTimeout(this.dropoffDebounce);
  }

  describeDestination(dest: TransferDestination): string {
    return [dest.place, dest.city, dest.country].filter(Boolean).join(', ') || dest.locationCode || 'Unknown location';
  }

  onLocationInput(field: 'pickup' | 'dropoff', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.activeField.set(field);
    // Any manual edit invalidates a previously selected code — force re-selection.
    (field === 'pickup' ? this.pickupCode : this.dropoffCode).set(null);
    const timer = field === 'pickup' ? this.pickupDebounce : this.dropoffDebounce;
    if (timer) clearTimeout(timer);

    const next = setTimeout(async () => {
      if (!value || value.trim().length < 2) {
        (field === 'pickup' ? this.pickupSuggestions : this.dropoffSuggestions).set([]);
        return;
      }
      try {
        const results = await this.transferService.searchDestinations(value.trim());
        // Only offer destinations that actually carry a locationCode — that's
        // the value the search API accepts, so a code-less entry can't be booked.
        const usable = (results || []).filter((d) => !!d.locationCode);
        (field === 'pickup' ? this.pickupSuggestions : this.dropoffSuggestions).set(usable);
      } catch (err) {
        console.error('Destination search failed', err);
      }
    }, 300);

    if (field === 'pickup') this.pickupDebounce = next;
    else this.dropoffDebounce = next;
  }

  selectSuggestion(field: 'pickup' | 'dropoff', dest: TransferDestination): void {
    const label = this.describeDestination(dest);
    const code = dest.locationCode ?? null;
    if (field === 'pickup') {
      this.searchForm.patchValue({ pickupLocation: label });
      this.pickupCode.set(code);
      this.pickupSuggestions.set([]);
    } else {
      this.searchForm.patchValue({ dropoffLocation: label });
      this.dropoffCode.set(code);
      this.dropoffSuggestions.set([]);
    }
    this.activeField.set(null);
  }

  async doSearch(): Promise<void> {
    const pickupCode = this.pickupCode();
    const dropoffCode = this.dropoffCode();
    if (this.searchForm.invalid || !pickupCode || !dropoffCode) {
      this.searchForm.markAllAsTouched();
      if (!pickupCode || !dropoffCode) {
        this.searchError.set('Please pick both pickup and dropoff locations from the suggestion list.');
      }
      return;
    }
    this.isSearching.set(true);
    this.searchError.set(null);
    this.products.set([]);
    const v = this.searchForm.getRawValue();
    try {
      const res = await this.transferService.search({
        search_currency: v.currency,
        journey_type: v.journeyType,
        // The real TravelNext search endpoint expects the destination's
        // locationCode here, not the free-text label shown in the input.
        pickup_location: pickupCode,
        dropoff_location: dropoffCode,
        adults: v.adults,
        children: v.children,
        infants: v.infants,
        arrival_date: v.arrivalDate || undefined,
        arrival_time: v.arrivalTime || undefined,
        departure_date: v.journeyType === 'Return' ? v.departureDate || undefined : undefined,
        departure_time: v.journeyType === 'Return' ? v.departureTime || undefined : undefined,
      });
      this.sessionId.set(res.sessionId ?? null);
      this.products.set(res.travelling?.products ?? []);
    } catch (err) {
      console.error('Transfer search failed', err);
      this.searchError.set(apiErrorMessage(err, 'Unable to search transfers right now. Please try again.'));
    } finally {
      this.isSearching.set(false);
      this.hasSearched.set(true);
    }
  }

  selectProduct(product: TransferProduct): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/transfers' } });
      return;
    }
    this.selectedProduct.set(product);
    this.bookingError.set(null);
    this.step.set('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToResults(): void {
    this.selectedProduct.set(null);
    this.step.set('search');
  }

  async submitBooking(): Promise<void> {
    const product = this.selectedProduct();
    const sessionId = this.sessionId();
    if (this.bookingForm.invalid || !product || !sessionId) {
      this.bookingForm.markAllAsTouched();
      return;
    }
    const productId = product.general?.productId;
    const bookingTypeId = product.general?.bookingTypeId;
    if (!productId) {
      this.bookingError.set('This transfer is missing a product identifier and cannot be booked.');
      return;
    }

    this.isBooking.set(true);
    this.bookingError.set(null);
    const v = this.bookingForm.getRawValue();
    try {
      const res = await this.transferService.book({
        session_id: sessionId,
        product_id: productId,
        booking_type_id: bookingTypeId || '',
        pax_details: {
          lead_title: v.leadTitle,
          lead_first_name: v.firstName,
          lead_last_name: v.lastName,
          phone: v.phone,
          email_id: v.email,
          address01: v.address01,
          zip_code: v.zipCode,
          address02: v.address02 || undefined,
        },
        accomodation_details: {
          accomodation_name: v.accomodationName,
          accomodation_address01: v.accomodationAddress01,
          accomodation_address02: v.accomodationAddress02 || undefined,
        },
        remark: v.remark || undefined,
      });
      this.bookingResult.set(res);
      this.step.set('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Transfer booking failed', err);
      this.bookingError.set(apiErrorMessage(err, 'Unable to complete this booking. Please try again.'));
      this.toast.error('Transfer booking failed');
    } finally {
      this.isBooking.set(false);
    }
  }

  startOver(): void {
    this.step.set('search');
    this.selectedProduct.set(null);
    this.bookingResult.set(null);
    this.sessionId.set(null);
    this.products.set([]);
    this.hasSearched.set(false);
    this.pickupCode.set(null);
    this.dropoffCode.set(null);
    this.searchForm.patchValue({ pickupLocation: '', dropoffLocation: '' });
  }
}
