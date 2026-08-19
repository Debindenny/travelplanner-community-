import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';

interface Testimonial {
  name: string;
  location: string;
  destination: string;
  quoteKey: string;
  rating: number;
  avatarUrl: string;
  tagEmoji: string;
  tagKey: string;
  tagColor: string;
  itineraryLink?: string;
}

@Component({
    selector: 'app-testimonials-section',
    imports: [SectionHeaderComponent, RouterLink, TranslatePipe],
    styles: [
        `
      :host { display: block; width: 100%; }

      .card {
        position: relative;
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.05);
        transition: transform 0.25s ease, box-shadow 0.25s ease;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 280px;
        scroll-snap-align: start;
      }
      .card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.10);
      }

      .quote-mark {
        position: absolute;
        top: 20px;
        right: 24px;
        font-size: 72px;
        line-height: 1;
        color: rgba(0, 96, 234, 0.08);
        font-family: Georgia, serif;
        pointer-events: none;
        user-select: none;
      }

      .star-fill { color: #FBBF24; }
      .star-empty { color: #e5e7eb; }

      .carousel-track {
        display: grid;
        gap: 1.5rem;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      @media (max-width: 1023px) {
        .carousel-track {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding-bottom: 0.25rem;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .carousel-track::-webkit-scrollbar { display: none; }
        .card { min-width: min(82vw, 320px); }
      }
    `,
    ],
    template: `
    <section id="testimonials" class="landing-section bg-surface-muted">
      <div class="section-container section-gap">
        <app-section-header
          [title]="'LANDING.TESTIMONIALS.TITLE' | translate"
          [watermark]="'LANDING.TESTIMONIALS.WATERMARK' | translate"
          [subtitle]="'LANDING.TESTIMONIALS.SUBTITLE' | translate"
          [subtleWatermark]="true"
        />

        <div class="carousel-track mx-auto mt-4 max-w-[1280px]">
          @for (t of testimonials; track t.name) {
            <div class="card">
              <span class="quote-mark" aria-hidden="true">"</span>

              <span
                class="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold"
                [style.background]="t.tagColor + '20'"
                [style.color]="t.tagColor"
              >{{ t.tagEmoji }} {{ t.tagKey | translate }}</span>

              <div class="flex gap-0.5" [attr.aria-label]="t.rating + ' out of 5 stars'">
                @for (s of starsArray(5); track s) {
                  <svg
                    class="h-4 w-4"
                    [class.star-fill]="s < t.rating"
                    [class.star-empty]="s >= t.rating"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                }
              </div>

              <p class="flex-1 text-sm-plus leading-relaxed text-gray-600">"{{ t.quoteKey | translate }}"</p>

              <div class="flex items-center gap-3 border-t border-gray-100 pt-4">
                <img [src]="t.avatarUrl" [alt]="t.name" class="h-10 w-10 shrink-0 rounded-full object-cover" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-gray-900">{{ t.name }}</p>
                  <p class="text-xs text-gray-400">{{ t.location }} · {{ 'LANDING.TESTIMONIALS.TRAVELLED_TO' | translate }} {{ t.destination }}</p>
                </div>
              </div>

              @if (t.itineraryLink) {
                <a
                  [routerLink]="t.itineraryLink"
                  class="text-xs font-semibold text-primary no-underline hover:underline"
                >
                  {{ 'LANDING.TESTIMONIALS.VIEW_TRIP' | translate:{ destination: t.destination } }}
                </a>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class TestimonialsSectionComponent {
  starsArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  readonly testimonials: Testimonial[] = [
    {
      name: 'Priya Sharma',
      location: 'Mumbai, India',
      destination: 'Bali',
      quoteKey: 'LANDING.TESTIMONIALS.QUOTE_PRIYA',
      rating: 5,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya&backgroundColor=b6e3f4',
      tagEmoji: '🌴',
      tagKey: 'LANDING.TESTIMONIALS.TAG_BEACH',
      tagColor: '#0891b2',
      itineraryLink: '/packages',
    },
    {
      name: 'Arjun Mehta',
      location: 'Bangalore, India',
      destination: 'Switzerland',
      quoteKey: 'LANDING.TESTIMONIALS.QUOTE_ARJUN',
      rating: 4,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun&backgroundColor=ffd5dc',
      tagEmoji: '❤️',
      tagKey: 'LANDING.TESTIMONIALS.TAG_HONEYMOON',
      tagColor: '#e11d48',
      itineraryLink: '/packages',
    },
    {
      name: 'Fatima Al-Rashid',
      location: 'Dubai, UAE',
      destination: 'Japan',
      quoteKey: 'LANDING.TESTIMONIALS.QUOTE_FATIMA',
      rating: 5,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima&backgroundColor=c0aede',
      tagEmoji: '🎒',
      tagKey: 'LANDING.TESTIMONIALS.TAG_SOLO',
      tagColor: '#0284c7',
      itineraryLink: '/packages',
    },
    {
      name: 'James & Sophie',
      location: 'London, UK',
      destination: 'Italy',
      quoteKey: 'LANDING.TESTIMONIALS.QUOTE_RAHUL',
      rating: 4,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JamesSophie&backgroundColor=d1f4d1',
      tagEmoji: '👨‍👩‍👧',
      tagKey: 'LANDING.TESTIMONIALS.TAG_FAMILY',
      tagColor: '#059669',
      itineraryLink: '/packages',
    },
  ];
}
