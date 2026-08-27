import { Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

/**
 * Discover/Saved-only copy of the "Your Journey" widget — kept separate from
 * `CommunityJourneyStatsComponent` so it can match `Community Home.dc.html`
 * exactly (ring/font sizes, spacing) without touching the Home page.
 */
@Component({
  selector: 'app-ds-community-journey-stats',
  imports: [TranslatePipe],
  template: `
    <div class="ds-journey">
      <div class="ds-journey__top">
        <span class="ds-journey__ring" [style.background]="ringBackground">
          <span class="ds-journey__ring-inner">
            <span class="ds-journey__pct">{{ xpPercent }}%</span>
            <span class="ds-journey__lv">LV.1</span>
          </span>
        </span>
        <div class="ds-journey__info">
          <span class="ds-journey__label">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_LABEL' | translate }}</span>
          <span class="ds-journey__title">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_TITLE' | translate }}</span>
          <span class="ds-journey__next">{{ 'COMMUNITY.HOME_SUBNAV.JOURNEY_NEXT_LEVEL' | translate: { xp: xpToNext } }}</span>
        </div>
      </div>

      <div class="ds-journey__track">
        <div class="ds-journey__fill" [style.width.%]="xpPercent"></div>
      </div>

      <div class="ds-journey__stats">
        @for (stat of stats; track stat.labelKey) {
          <div class="ds-journey__stat">
            <span class="ds-journey__stat-value">{{ stat.value }}</span>
            <span class="ds-journey__stat-label">{{ stat.labelKey | translate }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .ds-journey {
      font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
      padding-top: 18px;
      border-top: 1px solid #edf0f5;
      display: flex;
      flex-direction: column;
      gap: 13px;
    }

    .ds-journey__top {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ds-journey__ring {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      flex: none;
    }

    .ds-journey__ring-inner {
      position: absolute;
      inset: 6px;
      border-radius: 50%;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1.1;
    }

    .ds-journey__pct {
      font-size: 12.5px;
      font-weight: 800;
      color: #0b1220;
    }

    .ds-journey__lv {
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #8b94a3;
    }

    .ds-journey__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ds-journey__label {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #8b94a3;
      text-transform: uppercase;
    }

    .ds-journey__title {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #0b1220;
    }

    .ds-journey__next {
      font-size: 11px;
      font-weight: 600;
      color: #8b94a3;
    }

    .ds-journey__track {
      height: 5px;
      border-radius: 999px;
      background: #eef1f6;
      overflow: hidden;
    }

    .ds-journey__fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #0060ea, #2aa98b);
    }

    .ds-journey__stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 8px;
    }

    .ds-journey__stat {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .ds-journey__stat-value {
      font-size: 15px;
      font-weight: 800;
      color: #0b1220;
    }

    .ds-journey__stat-label {
      font-size: 10px;
      font-weight: 700;
      color: #8b94a3;
    }
  `],
})
export class DsCommunityJourneyStatsComponent {
  readonly xpPercent = 34;
  readonly xpToNext = 200;
  readonly ringBackground = `conic-gradient(#0060EA 0turn ${this.xpPercent / 100}turn, #EEF1F6 ${this.xpPercent / 100}turn 1turn)`;

  readonly stats = [
    { value: 14, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_COUNTRIES' },
    { value: 6, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_TRIPS' },
    { value: 132, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_FOLLOWERS' },
    { value: 48, labelKey: 'COMMUNITY.HOME_SUBNAV.STAT_HELPFUL' },
  ];
}
