import { Injectable, signal, computed } from '@angular/core';
import { SavedTrip, TripSegment } from '../trip/trip.service';

@Injectable({ providedIn: 'root' })
export class ItineraryStore {
  readonly trip = signal<SavedTrip | null>(null);

  readonly viewMode = signal<'itinerary' | 'swap-flight' | 'swap-train' | 'swap-car' | 'swap-bus' | 'swap-hotel' | 'hotel-detail' | 'swap-activity' | 'activity-detail' | 'car-detail' | 'flight-detail' | 'train-detail' | 'bus-detail'>('itinerary');

  // Collaboration
  readonly sharePanelOpen = signal(false);
  readonly tripIsConfirmed = signal(false);
  readonly myCollabRole = signal<'owner' | 'editor' | 'viewer'>('owner');
  
  // PDF
  readonly pdfExportData = signal<any | null>(null);
  readonly pdfDownloading = signal(false);
  
  // Trip State
  readonly tripNotes = signal<Array<{ text: string; day?: number; createdAt: string }>>([]);
  readonly isBooked = signal(false);
  readonly bookingInProgress = signal(false);
  readonly loadingSwap = signal(false);
  readonly tripLoading = signal(false);
  readonly tripLoadError = signal<string | null>(null);
  readonly tripSegmentsVersion = signal(0);
  readonly tripStartDate = signal<Date>(new Date());
  
  // Flight Swapping
  readonly swappingFlightRef = signal<{ dayDay: number; itemIndex: number; isReturn: boolean } | null>(null);
  readonly swappedFlights = signal<Record<string, any>>({});
  readonly selectedFlightDetail = signal<any | null>(null);
  readonly flightDetailTravelers = signal<number>(2);

  // Train Swapping
  readonly swappingTrainRef = signal<{ dayDay: number; itemIndex: number } | null>(null);
  readonly swappedTrains = signal<Record<string, any>>({});
  readonly selectedTrainDetail = signal<any | null>(null);
  readonly trainDetailTravelers = signal<number>(2);

  // Bus Swapping
  readonly swappingBusRef = signal<{ dayDay: number; itemIndex: number } | null>(null);
  readonly swappedBuses = signal<Record<string, any>>({});
  readonly selectedBusDetail = signal<any | null>(null);
  readonly busDetailTravelers = signal<number>(2);

  // Car Swapping
  readonly swappingCarRef = signal<{ dayDay: number; itemIndex: number } | null>(null);
  readonly swappedCars = signal<Record<string, any>>({});
  readonly selectedCarDetail = signal<any | null>(null);

  // Hotel Swapping
  readonly swappingHotelRef = signal<{ dayDay: number; itemIndex: number } | null>(null);
  readonly swappedHotels = signal<Record<string, any>>({});
  readonly selectedHotelDetail = signal<any | null>(null);
  readonly selectedHotelBedId = signal<string>('');
  readonly hotelPriceFilter = signal<number>(60000);
  readonly hotelRatingFilter = signal<number[]>([]);
  readonly hotelAmenitiesFilter = signal<string[]>([]);
  readonly hotelTypeFilter = signal<string[]>([]);
  readonly hotelPolicyFilter = signal<string[]>([]);
  readonly hotelDistanceFilter = signal<string[]>([]);
  readonly hotelBedFilter = signal<string[]>([]);
  readonly hotelAreaFilter = signal<string[]>([]);
  readonly hotelSearch = signal<string>('');
  readonly hotelSort = signal<'recommended' | 'price-low' | 'price-high' | 'rating'>('recommended');
  readonly hotelSortOpen = signal<boolean>(false);
  readonly tpExclusive = signal<boolean>(false);
  readonly hotelCurrentPage = signal<number>(1);

  // Activity Swapping
  readonly swappingActivityRef = signal<{ dayDay: number; itemIndex: number } | null>(null);
  readonly swappedActivities = signal<Record<string, any>>({});
  readonly addedActivities = signal<{ dayDay: number; activity: any }[]>([]);
  readonly addedTransport = signal<{ dayDay: number; item: any }[]>([]);
  readonly removedItemKeys = signal<Set<string>>(new Set());
  readonly addingTransportRef = signal<{ dayDay: number; transportType: 'flight' | 'train' | 'bus' | 'car' } | null>(null);
  readonly customItemOrder = signal<Record<number, string[]>>({});
  readonly activityPriceFilter = signal<number>(40000);
  readonly activityTimeFilter = signal<string[]>([]);
  readonly activityDurationFilter = signal<string[]>([]);
  readonly activityTypeFilter = signal<string[]>([]);
  readonly activityLocationFilter = signal<string[]>([]);
  readonly activityHighlightFilter = signal<string[]>([]);
  readonly activitySearch = signal<string>('');
  readonly selectedActivityDetail = signal<any | null>(null);
  readonly activityGalleryIndex = signal<number>(0);
  readonly activityDetailTravelers = signal<number>(2);
  readonly activityDetailTimeSlot = signal<string>('');

  /** Clears every swap/filter/customization signal — call when switching to a different trip. */
  resetTripState(): void {
    this.viewMode.set('itinerary');
    this.sharePanelOpen.set(false);
    this.tripIsConfirmed.set(false);
    this.myCollabRole.set('owner');
    this.pdfExportData.set(null);
    this.pdfDownloading.set(false);
    this.tripNotes.set([]);
    this.isBooked.set(false);
    this.bookingInProgress.set(false);
    this.loadingSwap.set(false);
    this.tripLoading.set(false);
    this.tripLoadError.set(null);
    this.tripSegmentsVersion.set(0);
    this.tripStartDate.set(new Date());
    this.swappingFlightRef.set(null);
    this.swappedFlights.set({});
    this.selectedFlightDetail.set(null);
    this.flightDetailTravelers.set(2);
    this.swappingTrainRef.set(null);
    this.swappedTrains.set({});
    this.selectedTrainDetail.set(null);
    this.trainDetailTravelers.set(2);
    this.swappingBusRef.set(null);
    this.swappedBuses.set({});
    this.selectedBusDetail.set(null);
    this.busDetailTravelers.set(2);
    this.swappingCarRef.set(null);
    this.swappedCars.set({});
    this.selectedCarDetail.set(null);
    this.swappingHotelRef.set(null);
    this.swappedHotels.set({});
    this.selectedHotelDetail.set(null);
    this.selectedHotelBedId.set('');
    this.hotelPriceFilter.set(60000);
    this.hotelRatingFilter.set([]);
    this.hotelAmenitiesFilter.set([]);
    this.hotelTypeFilter.set([]);
    this.hotelPolicyFilter.set([]);
    this.hotelDistanceFilter.set([]);
    this.hotelBedFilter.set([]);
    this.hotelAreaFilter.set([]);
    this.hotelSearch.set('');
    this.hotelSort.set('recommended');
    this.hotelSortOpen.set(false);
    this.tpExclusive.set(false);
    this.hotelCurrentPage.set(1);
    this.swappingActivityRef.set(null);
    this.swappedActivities.set({});
    this.addedActivities.set([]);
    this.addedTransport.set([]);
    this.removedItemKeys.set(new Set());
    this.addingTransportRef.set(null);
    this.customItemOrder.set({});
    this.activityPriceFilter.set(40000);
    this.activityTimeFilter.set([]);
    this.activityDurationFilter.set([]);
    this.activityTypeFilter.set([]);
    this.activityLocationFilter.set([]);
    this.activityHighlightFilter.set([]);
    this.activitySearch.set('');
    this.selectedActivityDetail.set(null);
    this.activityGalleryIndex.set(0);
    this.activityDetailTravelers.set(2);
    this.activityDetailTimeSlot.set('');
  }
  setTrip(trip: SavedTrip | null) {
    const previousId = this.trip()?.id ?? null;
    this.trip.set(trip);
    if (previousId !== (trip?.id ?? null)) {
      this.resetTripState();
    }
    if (trip) {
      this.tripIsConfirmed.set(!!trip.is_confirmed);
      this.tripStartDate.set(new Date(trip.startDate));
    }
  }
}
