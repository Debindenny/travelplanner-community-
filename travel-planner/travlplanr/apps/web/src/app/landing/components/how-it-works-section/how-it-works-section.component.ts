import { Component, Input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { HowItWorksStepsComponent } from './how-it-works-steps.component';
import { HowItWorksMockupComponent } from './how-it-works-mockup.component';

@Component({
    selector: 'app-how-it-works-section',
    imports: [SectionHeaderComponent, TranslatePipe, HowItWorksStepsComponent, HowItWorksMockupComponent],
    template: `
    <section id="how-it-works" class="landing-section bg-white">
      <div class="section-container">
        <app-section-header
          [title]="'LANDING.HOW.TITLE' | translate"
          [watermark]="'LANDING.HOW.WATERMARK' | translate"
          [subtitle]="'LANDING.HOW.SUBTITLE' | translate"
          [subtleWatermark]="true"
        />
        <div class="mx-auto mt-8 grid max-w-[1280px] items-center gap-14 lg:grid-cols-2">
          <app-how-it-works-mockup class="order-1 lg:order-2" [activeStep]="activeStep()" />
          <app-how-it-works-steps class="order-2 lg:order-1" (activeStepChange)="activeStep.set($event)" />
        </div>
      </div>
    </section>
  `
})
export class HowItWorksSectionComponent {
  readonly activeStep = signal<number>(1);
}
