import { Component, Input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { LogoComponent } from '../shared/components/logo/logo.component';
import { ItineraryPdfData, ItineraryPdfItem } from './itinerary-pdf.models';

@Component({
    selector: 'app-itinerary-pdf-template',
    imports: [LogoComponent, TranslatePipe],
    template: `
    @if (data) {
      <div class="pdf-root bg-white text-text-primary font-[Poppins,sans-serif] w-[794px] p-8 box-border">
        <div class="flex items-center gap-3 mb-6">
          <app-logo variant="dark" />
        </div>

        <h1 class="text-3xl font-semibold leading-tight text-text-primary mb-1">{{ data.tripTitle }}</h1>
        @if (data.variant === 'pre-booking') {
          <p class="text-sm font-medium text-text-primary mb-6">{{ data.dateRange }}</p>
        }

        <h2 class="text-lg font-semibold text-text-primary mb-3">{{ 'ITINERARY.PDF.SECTION_HEADING' | translate }}</h2>

        <div class="border border-[#E3F0FF] rounded overflow-hidden mb-8 text-xs">
          <div class="grid grid-cols-6 bg-[#F5F9FF] border-b border-[#E3F0FF] font-semibold">
            <div class="px-3 py-2.5 border-r border-[#E3F0FF] bg-[#F5F9FF]">{{ 'ITINERARY.PDF.TABLE_DESTINATION' | translate }}</div>
            <div class="px-3 py-2.5 border-r border-[#E3F0FF]">{{ 'ITINERARY.PDF.TABLE_DURATIONS' | translate }}</div>
            <div class="px-3 py-2.5 border-r border-[#E3F0FF] bg-[#F5F9FF]">{{ 'ITINERARY.PDF.TABLE_TRAVELLERS' | translate }}</div>
            <div class="px-3 py-2.5 border-r border-[#E3F0FF]">{{ 'ITINERARY.PDF.TABLE_INCLUSION' | translate }}</div>
            <div class="px-3 py-2.5 border-r border-[#E3F0FF] bg-[#F5F9FF]">{{ 'ITINERARY.PDF.TABLE_PRICE' | translate }}</div>
            <div class="px-3 py-2.5">{{ 'ITINERARY.PDF.TABLE_DEPARTURE_RETURN' | translate }}</div>
          </div>
          <div class="grid grid-cols-6">
            <div class="px-3 py-3 border-r border-[#E3F0FF] bg-[#F5F9FF] font-medium">{{ data.destinations }}</div>
            <div class="px-3 py-3 border-r border-[#E3F0FF] font-medium">{{ data.duration }}</div>
            <div class="px-3 py-3 border-r border-[#E3F0FF] bg-[#F5F9FF] font-medium">{{ data.travellers }}</div>
            <div class="px-3 py-3 border-r border-[#E3F0FF] font-medium leading-snug">{{ data.inclusion }}</div>
            <div class="px-3 py-3 border-r border-[#E3F0FF] bg-[#F5F9FF]">
              <div class="font-semibold">{{ data.price }}</div>
              @if (data.priceNote) {
                <div class="text-2xs text-text-secondary mt-1 leading-snug">{{ data.priceNote }}</div>
              }
            </div>
            <div class="px-3 py-3 font-medium">{{ data.departureReturn }}</div>
          </div>
        </div>

        <div class="space-y-5 mb-8">
          @for (day of data.days; track day.day) {
            <div class="pdf-avoid-break border border-[#F0F0F0] rounded-lg overflow-hidden">
              <div class="bg-primary text-white px-4 py-3 flex items-start gap-3 rounded-t-lg">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-primary text-xs-plus font-bold">
                  {{ day.day }}
                </span>
                <div>
                  <div class="text-sm font-semibold">{{ 'ITINERARY.PDF.DAY_LABEL' | translate: { day: day.day, title: day.title } }}</div>
                  <div class="text-2xs-plus text-white/80 mt-0.5">{{ day.dateStr }}</div>
                </div>
              </div>

              <div class="p-3 space-y-3 bg-white">
                @for (item of day.items; track $index) {
                  <div class="pdf-avoid-break border border-[#E8E8E8] rounded p-3 flex gap-3">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" alt="" class="w-12 h-12 rounded object-cover shrink-0 bg-surface-muted" />
                    } @else {
                      <div class="w-12 h-12 rounded bg-[#F5F9FF] shrink-0 flex items-center justify-center text-primary">
                        @switch (item.kind) {
                          @case ('flight') {
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                          }
                          @case ('train') {
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/></svg>
                          }
                          @case ('bus') {
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M5 20v2M19 20v2"/></svg>
                          }
                          @case ('hotel') {
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M3 11h18"/></svg>
                          }
                          @case ('car') {
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.7A2 2 0 0 0 13.7 5H10.3a2 2 0 0 0-1.6.8L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                          }
                          @default {
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                          }
                        }
                      </div>
                    }

                    <div class="flex-1 min-w-0">
                      <div class="text-xs-plus font-semibold text-text-primary">{{ item.title }}</div>
                      @if (item.subtitle) {
                        <div class="text-2xs-plus text-text-secondary mt-0.5">{{ item.subtitle }}</div>
                      }

                      @if (item.classLabel || item.refundable) {
                        <div class="flex flex-wrap gap-3 mt-2 text-2xs text-text-primary">
                          @if (item.classLabel) {
                            <span>{{ item.classLabel }}</span>
                          }
                          @if (item.refundable) {
                            <span>{{ item.refundable }}</span>
                          }
                        </div>
                      }

                      @if (isTransport(item)) {
                        <div class="grid grid-cols-3 gap-2 mt-3 text-center text-2xs">
                          <div>
                            <div class="text-text-secondary">{{ item.depDate }}</div>
                            <div class="text-xs-plus font-semibold text-text-primary">{{ item.depTime }}</div>
                            <div class="text-text-secondary">{{ item.depLocation }}</div>
                          </div>
                          <div class="flex flex-col items-center justify-center">
                            <div class="text-text-secondary">{{ item.duration }}</div>
                            <div class="w-full h-px bg-[#D9D9D9] my-1"></div>
                            <div class="text-text-secondary">{{ item.stops }}</div>
                          </div>
                          <div>
                            <div class="text-text-secondary">{{ item.arrDate }}</div>
                            <div class="text-xs-plus font-semibold text-text-primary">{{ item.arrTime }}</div>
                            <div class="text-text-secondary">{{ item.arrLocation }}</div>
                          </div>
                        </div>
                      }

                      @if (item.kind === 'hotel') {
                        <div class="mt-2 text-2xs text-text-secondary space-y-0.5">
                          @if (item.rating) {
                            <div>★ {{ item.rating }}</div>
                          }
                          @if (item.location) {
                            <div>{{ item.location }}</div>
                          }
                          @if (item.dates) {
                            <div>{{ item.dates }}</div>
                          }
                          @if (item.amenities?.length) {
                            <div class="flex flex-wrap gap-2 mt-1">
                              @for (amenity of item.amenities; track amenity) {
                                <span>{{ amenity }}</span>
                              }
                            </div>
                          }
                        </div>
                      }

                      @if (item.kind === 'activity') {
                        <div class="mt-2 text-2xs text-text-secondary space-y-0.5">
                          @if (item.time) {
                            <div>{{ item.time }}</div>
                          }
                          @if (item.location) {
                            <div>{{ item.location }}</div>
                          }
                          @if (item.refundable) {
                            <div>{{ item.refundable }}</div>
                          }
                        </div>
                      }

                      @if (item.kind === 'car') {
                        <div class="mt-2 text-2xs text-text-secondary space-y-0.5">
                          @if (item.dates) {
                            <div>{{ item.dates }}</div>
                          }
                          @if (item.location) {
                            <div>{{ item.location }}</div>
                          }
                        </div>
                      }

                      @if (item.cost) {
                        <div class="mt-2 text-2xs-plus font-semibold text-text-primary">{{ item.cost }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        @if (data.variant === 'post-booking') {
          <p class="text-sm font-medium text-text-primary mb-6">{{ data.dateRange }}</p>
        }

        <h2 class="text-lg font-semibold text-text-primary mb-3">
          {{ 'ITINERARY.PDF.PARTNERS_HEADING_PREFIX' | translate }} <span class="text-primary">{{ 'ITINERARY.PDF.PARTNERS_HEADING_HIGHLIGHT' | translate }}</span>
        </h2>
        <div class="flex flex-wrap gap-2 mb-8 p-3 bg-surface-muted rounded">
          @for (partner of data.partners; track partner) {
            <span class="px-3 py-2 bg-white border border-[#E8E8E8] rounded text-2xs-plus font-medium text-text-secondary">
              {{ partner }}
            </span>
          }
        </div>

        @if (data.variant === 'pre-booking') {
          <div class="pdf-avoid-break mb-8">
            <div class="inline-block bg-primary text-white text-sm font-medium px-6 py-2.5 rounded">
              {{ 'ITINERARY.PDF.BOOK_NOW' | translate }}
            </div>
            @if (data.bookingUrl) {
              <p class="mt-2 text-2xs-plus text-text-secondary leading-relaxed">
                {{ 'ITINERARY.PDF.BOOKING_URL_INTRO' | translate }}
                <span class="font-medium text-text-primary">{{ data.bookingUrl }}</span>
              </p>
            }
          </div>
        }

        @if (data.variant === 'post-booking') {
          <div class="pdf-avoid-break space-y-8 mb-8">
            <div>
              <h2 class="text-lg font-semibold text-text-primary mb-4">{{ 'ITINERARY.PDF.TERMS_HEADING' | translate }}</h2>

              <div class="space-y-5 text-xs text-text-primary leading-relaxed">
                <div>
                  <h3 class="text-sm font-medium mb-2">{{ 'ITINERARY.PDF.WHAT_WE_DO_TITLE' | translate }}</h3>
                  <p class="font-medium mb-1">{{ 'ITINERARY.PDF.WHAT_WE_DO_LABEL' | translate }}</p>
                  <ul class="list-disc pl-5 space-y-1 text-text-secondary">
                    <li>{{ 'ITINERARY.PDF.WHAT_WE_DO_ITEM_1' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.WHAT_WE_DO_ITEM_2' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.WHAT_WE_DO_ITEM_3' | translate }}</li>
                  </ul>
                  <p class="font-medium mt-3 mb-1">{{ 'ITINERARY.PDF.WHAT_WE_DONT_LABEL' | translate }}</p>
                  <ul class="list-disc pl-5 space-y-1 text-text-secondary">
                    <li>{{ 'ITINERARY.PDF.WHAT_WE_DONT_ITEM_1' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.WHAT_WE_DONT_ITEM_2' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.WHAT_WE_DONT_ITEM_3' | translate }}</li>
                  </ul>
                </div>

                <div>
                  <h3 class="text-sm font-medium mb-2">{{ 'ITINERARY.PDF.AI_DISCLAIMER_HEADING' | translate }}</h3>
                  <ul class="list-disc pl-5 space-y-1 text-text-secondary">
                    <li>{{ 'ITINERARY.PDF.AI_DISCLAIMER_ITEM_1' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.AI_DISCLAIMER_ITEM_2' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.AI_DISCLAIMER_ITEM_3' | translate }}</li>
                  </ul>
                </div>

                <div>
                  <h3 class="text-sm font-medium mb-2">{{ 'ITINERARY.PDF.BOOKINGS_PAYMENTS_HEADING' | translate }}</h3>
                  <ul class="list-disc pl-5 space-y-1 text-text-secondary">
                    <li>{{ 'ITINERARY.PDF.BOOKINGS_PAYMENTS_ITEM_1' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.BOOKINGS_PAYMENTS_ITEM_2' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.BOOKINGS_PAYMENTS_ITEM_3' | translate }}</li>
                  </ul>
                </div>

                <div>
                  <h3 class="text-sm font-medium mb-2">{{ 'ITINERARY.PDF.NOT_RESPONSIBLE_HEADING' | translate }}</h3>
                  <p class="font-medium mb-1">{{ 'ITINERARY.PDF.NOT_RESPONSIBLE_LABEL' | translate }}</p>
                  <ul class="list-disc pl-5 space-y-1 text-text-secondary">
                    <li>{{ 'ITINERARY.PDF.NOT_RESPONSIBLE_ITEM_1' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.NOT_RESPONSIBLE_ITEM_2' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.NOT_RESPONSIBLE_ITEM_3' | translate }}</li>
                    <li>{{ 'ITINERARY.PDF.NOT_RESPONSIBLE_ITEM_4' | translate }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h2 class="text-lg font-semibold text-text-primary mb-4">{{ 'ITINERARY.PDF.FAQ_HEADING' | translate }}</h2>
              <div class="space-y-4">
                @for (faq of data.faqItems; track faq.question) {
                  <div class="pdf-avoid-break">
                    <p class="text-xs-plus font-medium text-text-primary mb-1">{{ faq.question }}</p>
                    <p class="text-xs text-text-secondary leading-relaxed">{{ faq.answer }}</p>
                  </div>
                }
              </div>
            </div>

            <div class="pdf-avoid-break border border-[#E8E8E8] rounded-2xl p-5 bg-white">
              <h2 class="text-lg font-semibold text-text-primary mb-1">{{ 'ITINERARY.PDF.TRIP_SUMMARY_HEADING' | translate }}</h2>
              <p class="text-xs-plus text-text-secondary mb-5">{{ 'ITINERARY.PDF.TRIP_DURATION_LABEL' | translate: { duration: data.duration } }}</p>

              <div class="space-y-5">
                @for (section of data.summarySections; track section.title) {
                  <div>
                    <h3 class="text-sm font-medium text-text-primary mb-2">{{ section.title }}</h3>
                    <ul class="space-y-2">
                      @for (entry of section.items; track entry) {
                        <li class="flex items-start gap-2 text-xs text-text-primary">
                          <svg class="w-4 h-4 shrink-0 text-primary mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>{{ entry }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <p class="text-xs-plus font-medium text-text-primary">{{ 'ITINERARY.PDF.FOOTER_LABEL' | translate }}</p>
      </div>
    }
  `
})
export class ItineraryPdfTemplateComponent {
  @Input() data: ItineraryPdfData | null = null;

  isTransport(item: ItineraryPdfItem): boolean {
    return item.kind === 'flight' || item.kind === 'train' || item.kind === 'bus';
  }
}
