import { Component, inject, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { DestinationCarouselSectionComponent } from '../destination-carousel-section/destination-carousel-section.component';
import { LandingDestinationsService } from '../../services/landing-destinations.service';

@Component({
    selector: 'app-region-tabs-section',
    imports: [SectionHeaderComponent, DestinationCarouselSectionComponent, TranslatePipe],
    template: `
    <section
      id="regions"
      class="landing-section bg-white"
    >
      <div class="section-container">
        <app-section-header
          [title]="'LANDING.REGIONS.TITLE' | translate"
          [watermark]="'LANDING.REGIONS.WATERMARK' | translate"
          [subtitle]="'LANDING.REGIONS.SUBTITLE' | translate"
          [subtleWatermark]="true"
          [narrow]="false"
        />

        <div class="hide-scrollbar mt-8 flex gap-2 overflow-x-auto px-1 pb-1">
          @for (tab of regionTabs; track tab.id) {
            <button
              type="button"
              class="shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 active:scale-[0.98]"
              [class.bg-[#0060EA]]="activeTab() === tab.id"
              [class.text-white]="activeTab() === tab.id"
              [class.bg-white]="activeTab() !== tab.id"
              [class.text-gray-600]="activeTab() !== tab.id"
              [class.border]="activeTab() !== tab.id"
              [class.border-gray-200]="activeTab() !== tab.id"
              [class.shadow-sm]="activeTab() === tab.id"
              (click)="selectTab(tab.id)"
            >
              {{ tab.emoji }} {{ tab.labelKey | translate }}
            </button>
          }
        </div>

        <app-destination-carousel-section
          [embedded]="true"
          [showHeader]="false"
          [title]="getActiveTabTitle() | translate"
          [cards]="filteredRegionCards()"
          [loading]="destinations.isLoading()"
        />
      </div>
    </section>
  `
})
export class RegionTabsSectionComponent {
  readonly destinations = inject(LandingDestinationsService);

  readonly activeTab = signal<'all' | 'middle-east' | 'usa' | 'europe' | 'asia' | 'unique'>('all');

  readonly regionTabs = [
    { id: 'all', emoji: '🌍', labelKey: 'LANDING.REGIONS.TAB_ALL' },
    { id: 'middle-east', emoji: '🕌', labelKey: 'LANDING.REGIONS.TAB_MIDDLE_EAST' },
    { id: 'usa', emoji: '🗽', labelKey: 'LANDING.REGIONS.TAB_USA' },
    { id: 'europe', emoji: '🏰', labelKey: 'LANDING.REGIONS.TAB_EUROPE' },
    { id: 'asia', emoji: '🌴', labelKey: 'LANDING.REGIONS.TAB_ASIA' },
    { id: 'unique', emoji: '✨', labelKey: 'LANDING.REGIONS.TAB_UNIQUE' },
  ] as const;

  readonly filteredRegionCards = computed(() => {
    const tab = this.activeTab();
    if (tab === 'middle-east') return this.destinations.middleEastTrips();
    if (tab === 'usa') return this.destinations.unitedStatesTrips();
    if (tab === 'europe') return this.destinations.trendingEurope();
    if (tab === 'asia') return this.destinations.southEastAsiaTrips();
    if (tab === 'unique') return this.destinations.uniqueExperienceTrips();

    return [
      ...this.destinations.middleEastTrips().slice(0, 2),
      ...this.destinations.unitedStatesTrips().slice(0, 2),
      ...this.destinations.trendingEurope().slice(0, 2),
      ...this.destinations.southEastAsiaTrips().slice(0, 2),
      ...this.destinations.uniqueExperienceTrips().slice(0, 2),
    ];
  });

  selectTab(tabId: 'all' | 'middle-east' | 'usa' | 'europe' | 'asia' | 'unique') {
    this.activeTab.set(tabId);
  }

  getActiveTabTitle(): string {
    const tab = this.activeTab();
    if (tab === 'middle-east') return 'LANDING.REGIONS.TITLE_MIDDLE_EAST';
    if (tab === 'usa') return 'LANDING.REGIONS.TITLE_USA';
    if (tab === 'europe') return 'LANDING.REGIONS.TITLE_EUROPE';
    if (tab === 'asia') return 'LANDING.REGIONS.TITLE_ASIA';
    if (tab === 'unique') return 'LANDING.REGIONS.TITLE_UNIQUE';
    return 'LANDING.REGIONS.TITLE_ALL';
  }
}
