import { Component, EventEmitter, Input, Output, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import type { DetailDay, DetailItem } from '../../itinerary-page.component';
import { CurrencyConverterPipe } from '../../../shared/utils/currency-converter.pipe';
import { formatUsdCost } from '../../../shared/utils/price-to-usd';
import { localizeKnownPhrase, localizeTimeLabel } from '../../itinerary-i18n.util';

type TransportType = 'flight' | 'train' | 'bus' | 'car';

@Component({
    selector: 'app-itinerary-timeline',
    imports: [CommonModule, TranslatePipe, DragDropModule, CurrencyConverterPipe],
    templateUrl: './itinerary-timeline.component.html'
})
export class ItineraryTimelineComponent {
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  /** Forces template re-eval after language files load (instant() is not pipe-reactive). */
  private readonly langTick = signal(0);

  @Input() displayedDays: DetailDay[] = [];
  @Input() getItemKey: (item: DetailItem) => string = () => '';
  @Input() getFlightLogoUrl: (item: any) => string | undefined = () => undefined;
  @Input() getAirlineIataCode: (carrier: string) => string = () => '';
  @Input() cityNameForAirport: (code: string) => string = () => '';
  @Input() getCarImageUrl: (item: any) => string = () => '';
  @Input() getActivityImageUrl: (item: any) => string = (item) => item?.image || '';
  @Input() getTrainImageUrl: (item: any) => string = () => '';
  @Input() getBusImageUrl: (item: any) => string = () => '';
  @Input() isTransferDay: (dayDay: number) => boolean = () => false;
  @Input() transportModeOptions: { id: TransportType; labelKey: string }[] = [];

  @Output() itemDropped = new EventEmitter<CdkDragDrop<{ day: number; items: DetailItem[] }>>();
  @Output() moveUp = new EventEmitter<{ day: number; index: number }>();
  @Output() moveDown = new EventEmitter<{ day: number; index: number }>();
  @Output() flightSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() carSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() hotelSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() activitySwap = new EventEmitter<{ day: number; index: number }>();
  @Output() trainSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() busSwap = new EventEmitter<{ day: number; index: number }>();
  @Output() book = new EventEmitter<DetailItem>();
  @Output() activityAdd = new EventEmitter<number>();
  @Output() eventAdd = new EventEmitter<number>();
  @Output() cruiseAdd = new EventEmitter<number>();
  @Output() hotelAdd = new EventEmitter<number>();
  @Output() holidayAdd = new EventEmitter<number>();
  @Output() transferAdd = new EventEmitter<number>();
  @Output() transportAdd = new EventEmitter<{ day: number; type: TransportType }>();
  @Output() openComments = new EventEmitter<number>();

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => {
      this.langTick.update((n) => n + 1);
      this.cdr.markForCheck();
    });
  }

  /** Fare display — prices arrive already converted for the active currency. */
  protected fareCost(item: { price?: number; currency?: string; provider?: string; type?: string; cost?: string }): string {
    return formatUsdCost(item) ?? item.cost ?? '';
  }

  protected localizePhrase(value: string | null | undefined): string {
    this.langTick();
    return localizeKnownPhrase(value, (key, params) => this.translate.instant(key, params));
  }

  protected localizeTime(value: string | null | undefined): string {
    this.langTick();
    return localizeTimeLabel(value, (key, params) => this.translate.instant(key, params));
  }
}
