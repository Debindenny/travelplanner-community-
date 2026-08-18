import { Component, input, signal, OnInit, OnDestroy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-how-it-works-mockup',
    imports: [TranslatePipe],
    styles: [
        `
      :host { display: block; }
      /* ── Browser mockup ── */
      .browser-frame {
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.08);
        box-shadow:
          0 0 0 1px rgba(0,0,0,0.03),
          0 20px 50px -10px rgba(0,0,0,0.12),
          0 10px 20px -12px rgba(0,0,0,0.08);
        background: #fff;
      }
      .browser-bar {
        background: #f4f4f5;
        border-bottom: 1px solid #e4e4e7;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .trafficdot {
        width: 10px; height: 10px; border-radius: 50%;
      }
      .url-pill {
        flex: 1;
        background: #fff;
        border: 1px solid #e4e4e7;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11px;
        color: #71717a;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* ── Itinerary list layout ── */
      .itinerary-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid #f3f4f6;
      }
      .itinerary-row:last-child { border-bottom: none; }

      .time-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* ── Floating badge ── */
      .float-badge {
        position: absolute;
        bottom: -16px;
        right: -16px;
        background: #fff;
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 14px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05);
      }

      /* Mockup inner transitions */
      @keyframes mockupFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-mockup {
        animation: mockupFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      /* Progress Bar keyframe animation */
      @keyframes loadingBar {
        0% { width: 15%; }
        45% { width: 60%; }
        70% { width: 82%; }
        100% { width: 95%; }
      }
      .animate-loading {
        animation: loadingBar 5s infinite cubic-bezier(0.1, 0.8, 0.2, 1);
      }
    `
    ],
    template: `
    <div class="relative">
      <!-- Ambient glow -->
      <div class="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-blue-100/60 via-transparent to-transparent blur-2xl"></div>

      <div class="browser-frame relative">
        <!-- Browser top bar -->
        <div class="browser-bar">
          <span class="trafficdot" style="background:#ff5f57"></span>
          <span class="trafficdot" style="background:#febc2e"></span>
          <span class="trafficdot" style="background:#28c840"></span>
          <div class="url-pill">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#a1a1aa" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="7" width="10" height="8" rx="1.5"/>
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>
            </svg>
            travlplanr.com/{{ activeStep() === 1 ? 'wizard' : 'itinerary' }}
          </div>
        </div>

        <!-- Mockup content wrapper -->
        <div class="bg-gray-50 min-h-[390px] flex flex-col justify-between">

          <!-- ── MOCKUP STATE 1: Real Step 1 (Destination input form matching the real wizard) ── -->
          @if (activeStep() === 1) {
            <div class="animate-mockup p-6 flex flex-col justify-between flex-1">
              <div class="mb-5 w-full">
                <div class="flex justify-between items-center mb-1.5">
                  <span class="text-2xs-plus font-semibold text-gray-400">{{ 'LANDING.HOW.MOCKUP_STEP_LABEL' | translate }}</span>
                  <span class="text-2xs-plus font-bold text-[#0060EA]">{{ 'LANDING.HOW.MOCKUP_PERCENT_LABEL' | translate }}</span>
                </div>
                <div class="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-[#0060EA] rounded-full" style="width: 20%"></div>
                </div>
              </div>

              <div class="flex flex-col items-center text-center mb-5">
                <div class="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                  <img src="assets/icons/plane.svg" [alt]="'LANDING.HOW.ICON_DESTINATION_ALT' | translate" class="w-6 h-6 object-contain" />
                </div>
                <h3 class="text-sm font-bold text-gray-800">{{ 'LANDING.HOW.MOCKUP_QUESTION' | translate }}</h3>
                <p class="text-2xs text-gray-400">{{ 'LANDING.HOW.MOCKUP_SUBTEXT' | translate }}</p>
              </div>

              <div class="space-y-4">
                <div>
                  <div class="border border-gray-200 rounded-xl p-2.5 bg-white flex items-center shadow-sm">
                    <input type="text" value="Paris, France" class="w-full text-xs font-semibold text-gray-800 bg-transparent outline-none" readonly />
                    <img src="assets/icons/cancel.svg" [alt]="'LANDING.HOW.CANCEL_ALT' | translate" class="w-4 h-4 opacity-40 ml-2" />
                  </div>
                  <button type="button" class="mt-2 flex items-center gap-1 text-[#0060EA] text-xs font-semibold hover:opacity-80">
                    <img src="assets/icons/plus.svg" [alt]="'LANDING.HOW.ADD_ALT' | translate" class="w-4 h-4 object-contain" />
                    {{ 'LANDING.HOW.ADD_CITY_BUTTON' | translate }}
                  </button>
                </div>

                <div>
                  <h4 class="text-2xs-plus font-semibold text-gray-700 mb-1.5">{{ 'LANDING.HOW.MOCKUP_TRIP_RANGE_LABEL' | translate }}</h4>
                  <div class="border border-gray-200 rounded-xl p-2.5 bg-white shadow-sm">
                    <input type="text" value="London, UK" class="w-full text-xs text-gray-500 bg-transparent outline-none" readonly />
                  </div>
                  <label class="flex items-center gap-2 mt-2">
                    <input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-[#0060EA]" />
                    <span class="text-2xs-plus text-gray-500">{{ 'LANDING.HOW.ARRIVAL_DIFFERENT_LABEL' | translate }}</span>
                  </label>
                </div>
              </div>
            </div>
          }

          <!-- ── MOCKUP STATE 2: Real loading overlay replica ── -->
          @if (activeStep() === 2) {
            <div class="animate-mockup p-6 flex flex-col justify-center items-center text-center flex-1 bg-white rounded-b-xl">
              <div class="mb-8 w-full">
                <div class="flex justify-between items-center mb-1.5">
                  <span class="text-2xs-plus font-semibold text-gray-400">{{ 'LANDING.HOW.GENERATING_LABEL' | translate }}</span>
                  <span class="text-2xs-plus font-bold text-[#0060EA]">{{ 'LANDING.HOW.ANALYZING_LABEL' | translate }}</span>
                </div>
                <div class="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-[#0060EA] rounded-full animate-loading"></div>
                </div>
              </div>

              <div class="relative mb-6 flex w-full max-w-[280px] items-center justify-center">
                <div class="absolute left-0 right-0 top-1/2 h-px border-t border-dashed border-[#B3D4FF]"></div>
                <div class="relative z-10 flex h-[64px] w-[64px] items-center justify-center rounded-full border-2 border-[#0060EA] bg-[#F5F9FF] shadow-[0_4px_16px_rgba(0,96,234,0.12)]">
                  @for (icon of overlayIcons; track icon; let i = $index) {
                    <img
                      [src]="'assets/icons/' + icon + '.svg'"
                      [alt]="'LANDING.HOW.ICON_ALT' | translate"
                      class="absolute h-8 w-8 object-contain transition-all duration-300"
                      [style.opacity]="activeIndex() === i ? '1' : '0'"
                      [style.transform]="activeIndex() === i ? 'scale(1)' : 'scale(0.75)'"
                    />
                  }
                </div>
              </div>

              <p class="text-sm font-semibold text-[#0060EA]">{{ 'LANDING.HOW.CREATING_PLAN_LABEL' | translate }}</p>
              <p class="text-2xs-plus text-gray-400 mt-1 max-w-[240px]">{{ 'LANDING.HOW.CREATING_PLAN_SUBTEXT' | translate }}</p>
            </div>
          }

          <!-- ── MOCKUP STATE 3: Personalise, Book & Share ── -->
          @if (activeStep() === 3) {
            <div class="animate-mockup p-4 flex-1">
              
              <div class="mb-3 rounded-xl bg-white border border-gray-100 p-2.5 shadow-sm flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="flex -space-x-1.5">
                    <img class="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="https://ui-avatars.com/api/?name=Priya+S&background=667eea&color=fff" alt="Priya">
                    <img class="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="https://ui-avatars.com/api/?name=Arjun+M&background=f5576c&color=fff" alt="Arjun">
                  </div>
                  <span class="text-2xs font-semibold text-gray-500">{{ 'LANDING.HOW.SHARED_WITH_FRIENDS' | translate }}</span>
                </div>
                <button class="flex items-center gap-1.5 bg-[#0060EA] hover:bg-[#0050d0] text-white px-3 py-1 rounded-lg text-2xs font-bold transition-all shadow-sm">
                  <img src="assets/icons/right.svg" [alt]="'LANDING.HOW.INVITE_ALT' | translate" class="w-3.5 h-3.5 brightness-0 invert rotate-[-90deg] object-contain" />
                  {{ 'LANDING.HOW.INVITE_BUTTON' | translate }}
                </button>
              </div>

              <div class="mb-3 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div class="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <span class="rounded bg-gray-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{{ 'LANDING.HOW.DAY_LABEL' | translate }}</span>
                  <span class="flex-1 text-xs font-semibold text-gray-800">{{ 'LANDING.HOW.ITINERARY_STOP_TITLE' | translate }}</span>
                  <span class="text-2xs text-gray-400">Dec 15</span>
                </div>

                <div class="itinerary-row flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="time-dot" [style.background]="swapped() ? '#16a34a' : '#2563EB'"></span>
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" [style.background]="swapped() ? '#F0FDF4' : '#EFF6FF'">
                      <img
                        [src]="swapped() ? 'assets/icons/cutlery.svg' : 'assets/icons/location.svg'"
                        [alt]="'LANDING.HOW.ACTIVITY_ICON_ALT' | translate"
                        class="w-4 h-4 object-contain"
                      />
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-gray-800">
                        {{ (swapped() ? 'LANDING.HOW.ACTIVITY_ALT_TITLE' : 'LANDING.HOW.ACTIVITY_DEFAULT_TITLE') | translate }}
                      </p>
                      <p class="text-[9px] text-gray-400">
                        {{ (swapped() ? 'LANDING.HOW.ACTIVITY_ALT_DESC' : 'LANDING.HOW.ACTIVITY_DEFAULT_DESC') | translate }}
                      </p>
                    </div>
                  </div>
                  <span class="shrink-0 flex items-center gap-1 border border-blue-200 text-blue-600 px-2 py-1 rounded text-2xs font-bold">
                    Partner
                  </span>
                </div>

                <div class="itinerary-row flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="time-dot bg-purple-600"></span>
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                      <img src="assets/icons/passport.svg" [alt]="'LANDING.HOW.STAY_ICON_ALT' | translate" class="w-4 h-4 object-contain" />
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-gray-800">Hotel Regina Louvre</p>
                      <p class="text-[9px] text-gray-400">{{ 'LANDING.HOW.LUXURY_STAY_LABEL' | translate }}</p>
                    </div>
                  </div>
                  <span class="shrink-0 flex items-center gap-1 bg-[#0060EA] text-white px-2.5 py-1 rounded text-2xs font-bold shadow-sm">
                    {{ 'LANDING.HOW.BOOK_ROOM_BUTTON' | translate }}
                  </span>
                </div>
              </div>

              <div class="rounded-xl border border-dashed border-gray-200 bg-white p-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs">🔄</span>
                  <span class="text-2xs-plus text-gray-500 font-medium font-[Inter,sans-serif]">{{ 'LANDING.HOW.CUSTOMIZE_PROMPT' | translate }}</span>
                </div>
                <button type="button" class="text-xs text-blue-600 font-bold hover:text-blue-700 transition-colors" (click)="simulateSwap()">
                  {{ (swapped() ? 'LANDING.HOW.REVERT_BUTTON' : 'LANDING.HOW.SWAP_BUTTON') | translate }}
                </button>
              </div>
            </div>
          }

        </div>
      </div>

      <div class="float-badge">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
          <img src="assets/icons/location.svg" [alt]="'LANDING.HOW.SUCCESS_ALT' | translate" class="w-4 h-4 object-contain" />
        </div>
        <div>
          <p class="text-xs font-bold text-gray-900">{{ 'LANDING.HOW.READY_BADGE_TITLE' | translate }}</p>
          <p class="text-2xs-plus text-gray-400">{{ 'LANDING.HOW.READY_BADGE_SUBTITLE' | translate }}</p>
        </div>
      </div>
    </div>
  `
})
export class HowItWorksMockupComponent implements OnInit, OnDestroy {
  readonly activeStep = input.required<number>();
  readonly swapped = signal<boolean>(false);
  
  readonly overlayIcons = [
    'passport',
    'location',
    'plane',
    'car',
    'cab',
    'rental-car',
    'trip'
  ];
  readonly activeIndex = signal(0);

  private overlayIntervalId?: any;

  ngOnInit() {
    this.startOverlayAnimation();
  }

  ngOnDestroy() {
    this.stopOverlayAnimation();
  }

  simulateSwap() {
    this.swapped.update(v => !v);
  }

  private startOverlayAnimation() {
    if (typeof window === 'undefined') return;
    this.overlayIntervalId = setInterval(() => {
      this.activeIndex.update((index) => (index + 1) % this.overlayIcons.length);
    }, 700);
  }

  private stopOverlayAnimation() {
    if (this.overlayIntervalId) {
      clearInterval(this.overlayIntervalId);
      this.overlayIntervalId = undefined;
    }
  }
}
