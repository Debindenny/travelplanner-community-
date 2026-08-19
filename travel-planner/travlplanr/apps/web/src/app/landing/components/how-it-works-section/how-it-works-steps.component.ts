import { Component, OnInit, OnDestroy, signal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-how-it-works-steps',
    imports: [RouterLink, TranslatePipe],
    styles: [
        `
      :host { display: block; }
      /* ── Connector line between steps ── */
      .step-connector {
        width: 2px;
        height: 32px;
        background: linear-gradient(to bottom, #e2e8f0 30%, transparent);
        margin: 0 auto;
      }

      /* ── Step icon ring ── */
      .step-icon-ring {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 14px;
        flex-shrink: 0;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .step-card:hover .step-icon-ring {
        transform: scale(1.08) rotate(3deg);
      }

      /* ── Step number badge ── */
      .step-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #0060EA;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #fff;
        box-shadow: 0 1px 4px rgba(0,96,234,0.3);
      }

      /* ── Step card ── */
      .step-card {
        background: #fff;
        border: 1.5px solid rgba(0,0,0,0.05);
        border-radius: 16px;
        padding: 20px 24px;
        display: flex;
        align-items: flex-start;
        gap: 18px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        user-select: none;
      }
      .step-card:hover {
        border-color: rgba(0, 96, 234, 0.15);
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        transform: translateY(-2px);
      }
      .step-card.active-step {
        border-color: #0060EA;
        background-color: rgba(0, 96, 234, 0.015);
        box-shadow: 0 10px 25px -5px rgba(0, 96, 234, 0.08), 0 8px 10px -6px rgba(0, 96, 234, 0.08);
      }
    `
    ],
    template: `
    <div class="flex flex-col" (mouseenter)="pauseAutoRotate()" (mouseleave)="resumeAutoRotate()" (focusin)="pauseAutoRotate()" (focusout)="resumeAutoRotate()">
      
      <!-- Step 1 -->
      <div class="step-card" [class.active-step]="activeStep() === 1" (click)="selectStep(1)">
        <div class="step-icon-ring" style="background: #EFF6FF;">
          <span class="step-badge">1</span>
          <img src="assets/icons/plane.svg" [alt]="'LANDING.HOW.ICON_DESTINATION_ALT' | translate" class="w-6 h-6 object-contain" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-gray-900">{{ 'LANDING.HOW_STEP1_TITLE' | translate }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-500">
            {{ 'LANDING.HOW_DATA_STEP1_DESC' | translate }}
          </p>
        </div>
      </div>

      <!-- Connector -->
      <div class="my-2 ml-[37px]">
        <div class="step-connector"></div>
      </div>

      <!-- Step 2 -->
      <div class="step-card" [class.active-step]="activeStep() === 2" (click)="selectStep(2)">
        <div class="step-icon-ring" style="background: #F0FDF4;">
          <span class="step-badge" style="background: #16a34a;">2</span>
          <img src="assets/icons/ai-sparkles.svg" [alt]="'LANDING.HOW.ICON_AI_ALT' | translate" class="w-6 h-6 object-contain" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-gray-900">{{ 'LANDING.HOW_STEP2_TITLE' | translate }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-500">
            {{ 'LANDING.HOW_DATA_STEP2_DESC' | translate }}
          </p>
        </div>
      </div>

      <!-- Connector -->
      <div class="my-2 ml-[37px]">
        <div class="step-connector"></div>
      </div>

      <!-- Step 3 -->
      <div class="step-card" [class.active-step]="activeStep() === 3" (click)="selectStep(3)">
        <div class="step-icon-ring" style="background: #FFF7ED;">
          <span class="step-badge" style="background: #ea580c;">3</span>
          <img src="assets/icons/trip.svg" [alt]="'LANDING.HOW.ICON_PERSONALISE_ALT' | translate" class="w-6 h-6 object-contain" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-gray-900">{{ 'LANDING.HOW_STEP3_TITLE' | translate }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-500">
            {{ 'LANDING.HOW_DATA_STEP3_DESC' | translate }}
          </p>

          <div class="mt-3.5 flex items-center gap-3 border-t border-gray-100 pt-3">
            <span class="text-2xs font-bold uppercase tracking-wider text-gray-400">{{ 'LANDING.HOW.INTEGRATED_BOOKINGS_LABEL' | translate }}</span>
            <div class="flex items-center gap-3">
              <img src="assets/images/partners/google-maps.png" alt="Google Maps" class="h-4 w-4 object-contain grayscale opacity-50" />
              <img src="assets/images/partners/tripadvisor.png" alt="Tripadvisor" class="h-3.5 object-contain grayscale opacity-50" />
            </div>
          </div>
        </div>
      </div>

      <!-- CTA row -->
      <div class="mt-8 flex items-center gap-5">
        <a
          routerLink="/wizard"
          class="btn-primary-pill h-11 px-7 text-sm-plus no-underline"
        >
          {{ 'LANDING.HOW.CTA_TRY_FREE' | translate }}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <a
          routerLink="/how-it-works"
          class="text-sm font-medium text-gray-500 no-underline transition-colors hover:text-gray-900"
        >
          {{ 'LANDING.HOW.CTA_LEARN_MORE' | translate }}
        </a>
      </div>
    </div>
  `
})
export class HowItWorksStepsComponent implements OnInit, OnDestroy {
  readonly activeStep = signal<number>(1);
  readonly activeStepChange = output<number>();

  private autoRotateSub?: any;
  private userInteracted = false;

  ngOnInit() {
    this.startAutoRotate();
  }

  ngOnDestroy() {
    this.stopAutoRotate();
  }

  selectStep(step: number) {
    this.activeStep.set(step);
    this.activeStepChange.emit(step);
    this.userInteracted = true;
    this.stopAutoRotate(); // Stop auto-rotation once user interacts
  }

  pauseAutoRotate() {
    if (!this.userInteracted) {
      this.stopAutoRotate();
    }
  }

  resumeAutoRotate() {
    if (!this.userInteracted) {
      this.startAutoRotate();
    }
  }

  private startAutoRotate() {
    if (typeof window === 'undefined') return;
    this.autoRotateSub = setInterval(() => {
      const nextStep = (this.activeStep() % 3) + 1;
      this.activeStep.set(nextStep);
      this.activeStepChange.emit(nextStep);
    }, 6000);
  }

  private stopAutoRotate() {
    if (this.autoRotateSub) {
      clearInterval(this.autoRotateSub);
      this.autoRotateSub = undefined;
    }
  }
}
