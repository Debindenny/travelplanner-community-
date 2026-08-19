import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AnimatedLinkComponent } from '../../../shared/components/animated-link/animated-link.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { CarouselCard } from '../../../shared/models/landing.models';
import { TravelChatSessionService } from '../../../shared/services/travel-chat-session.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-journeys-section',
  standalone: true,
  imports: [AnimatedLinkComponent, SectionHeaderComponent, RouterModule, TranslatePipe],
  template: `
    <section class="bg-white py-[80px]">
      <div class="section-container section-gap">
        <app-section-header
          [title]="'LANDING.JOURNEYS.TITLE' | translate"
          [subtitle]="'LANDING.JOURNEYS.SUBTITLE' | translate"
        />

        <div class="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 pb-2 lg:-mx-0 lg:px-0">
          @for (journey of journeys; track journey.title) {
            <article
              (click)="planJourney(journey)"
              class="group relative h-[258px] w-[302px] shrink-0 overflow-hidden rounded-lg cursor-pointer"
            >
              <img
                [src]="journey.image"
                [alt]="journey.title"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div
                class="absolute inset-x-0 bottom-0 h-[95px] bg-gradient-to-t from-text-primary to-transparent"
              ></div>
              <div class="absolute bottom-4 left-0 right-0 px-4 text-center text-white">
                <p class="text-sm font-medium tracking-[0.56px]">{{ journey.subtitle }}</p>
                <h3 class="mt-1 text-5xl font-semibold leading-none tracking-wide">
                  {{ journey.title }}
                </h3>
              </div>
            </article>
          }
        </div>

        <div class="flex justify-center">
          <app-animated-link
            variant="underline-ltr"
            routerLink="/explore"
            class="text-base font-medium text-text-primary"
          >
            {{ 'LANDING.JOURNEYS.EXPLORE_ALL' | translate }}
          </app-animated-link>
        </div>
      </div>
    </section>
  `,
})
export class JourneysSectionComponent {
  private readonly router = inject(Router);
  private readonly chat = inject(TravelChatSessionService);

  readonly journeys: CarouselCard[] = [];

  planJourney(journey: CarouselCard): void {
    // Hand off to the AI chat planner instead of the manual wizard — the
    // hero chat on the home page picks this up via the shared prefill signal.
    this.chat.prefillComposer(`Plan a trip to ${journey.title}`);
    this.router.navigate(['/']);
  }
}
