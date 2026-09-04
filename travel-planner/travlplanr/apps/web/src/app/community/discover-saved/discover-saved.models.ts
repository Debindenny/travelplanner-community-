export type DiscoverPlace = 'All places' | 'Paris' | 'Tokyo' | 'Kyoto' | 'Lisbon' | 'Europe';
export type DiscoverSort = 'Most used' | 'Newest' | 'Most saved';

export interface DiscoverFact {
  label: string;
  value: string;
}

export interface DiscoverItem {
  id: string;
  tag: string;
  category: string;
  place: string;
  title: string;
  used: string;
  blurb: string;
  author: string;
  authorLine: string;
  body: string;
  facts: DiscoverFact[];
  points: string[];
  image: string;
  useCount: number;
  saveCount: number;
  isSaved: boolean;
  createdAt: string;
}

export interface DiscoverPlaceOption {
  label: string;
  count: number;
}

export interface DiscoverFilters {
  categories: string[];
  places: DiscoverPlaceOption[];
  sorts: string[];
}

export type SavedCollectionKind = 'Tip' | 'Trip' | 'Spot';
export type SavedCollectionTab = 'All' | 'Tips' | 'Trips' | 'Spots';

export interface SavedCollectionItem {
  id: string;
  kind: SavedCollectionKind;
  title: string;
  meta: string;
  image: string;
}

export type SavedCollectionCard = SavedCollectionItem;

export interface SavedFact {
  label: string;
  value: string;
}

export interface SavedDetailPayload {
  id: string;
  tag: string;
  place: string;
  title: string;
  image: string;
  used: string;
  facts: SavedFact[];
}

export interface ItineraryItem {
  time: string;
  name: string;
}

export interface ItineraryDay {
  date: string;
  items: ItineraryItem[];
}

export interface TripPickOption {
  id: string;
  name: string;
  dates: string;
  places: string[];
}

export interface AddToTripPayload {
  spot: string;
  meta: string;
  image: string;
}

export type ModalKind = 'addToTrip' | 'discoverDetail' | 'savedDetail';

export interface ModalState {
  kind: ModalKind;
  addToTrip?: AddToTripPayload;
  discoverItem?: DiscoverItem;
  savedItem?: SavedDetailPayload;
}
