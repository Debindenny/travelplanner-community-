export type DestinationFilter =
  | 'in-season'
  | 'honeymoon'
  | 'trending'
  | 'budget'
  | 'family'
  | 'popular';

export interface DestinationOption {
  name: string;
  filters: DestinationFilter[];
}

export const DESTINATION_FILTERS: { id: DestinationFilter; label: string }[] = [
  { id: 'in-season', label: 'In season' },
  { id: 'honeymoon', label: 'Honeymoon' },
  { id: 'trending', label: 'Trending' },
  { id: 'budget', label: 'Budget' },
  { id: 'family', label: 'Family' },
  { id: 'popular', label: 'Popular' },
];

export const POPULAR_DESTINATIONS_LIST: DestinationOption[] = [
  { name: 'Thailand', filters: ['trending', 'budget', 'popular', 'in-season'] },
  { name: 'Paris', filters: ['honeymoon', 'trending', 'popular'] },
  { name: 'Singapore', filters: ['family', 'trending', 'popular'] },
  { name: 'Malaysia', filters: ['budget', 'family', 'popular'] },
  { name: 'Switzerland', filters: ['honeymoon', 'trending'] },
  { name: 'Dubai', filters: ['trending', 'popular', 'family'] },
  { name: 'Italy', filters: ['honeymoon', 'trending', 'popular', 'in-season'] },
  { name: 'Japan', filters: ['trending', 'popular', 'family'] },
  { name: 'Spain', filters: ['trending', 'budget', 'in-season'] },
  { name: 'Türkiye', filters: ['budget', 'trending', 'in-season'] },
  { name: 'Mexico', filters: ['budget', 'family', 'in-season'] },
  { name: 'Maldives', filters: ['honeymoon', 'popular', 'trending'] },
  { name: 'Goa', filters: ['budget', 'family', 'in-season'] },
];
