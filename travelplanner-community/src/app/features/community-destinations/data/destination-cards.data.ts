import { unsplashUrl } from '../../../shared/utils/unsplash';

export interface DestinationStat {
  label: string;
  value: string;
}

export interface DestinationCard {
  id: string;
  name: string;
  coverUrl: string;
  livePlanningCount: number;
  travelerCount: number;
  travelerCountLabel: string;
  distanceKm: number;
  hot: boolean;
  stats: DestinationStat[];
}

interface DestinationSeed extends Omit<DestinationCard, 'coverUrl'> {
  coverPhotoId: string;
}

const DESTINATION_SEEDS: DestinationSeed[] = [
  {
    id: 'ds1',
    name: 'Paris, France',
    coverPhotoId: '1502602898657-3e91760cbb34',
    livePlanningCount: 428,
    travelerCount: 24800,
    travelerCountLabel: '24.8K travelers',
    distanceKm: 8940,
    hot: true,
    stats: [
      { label: 'Tips', value: '3.1K' },
      { label: 'Trips', value: '412' },
      { label: 'Events', value: '96' },
    ],
  },
  {
    id: 'ds2',
    name: 'Tokyo, Japan',
    coverPhotoId: '1540959733332-eab4deabeeaf',
    livePlanningCount: 610,
    travelerCount: 38200,
    travelerCountLabel: '38.2K travelers',
    distanceKm: 10870,
    hot: true,
    stats: [
      { label: 'Tips', value: '5.4K' },
      { label: 'Trips', value: '780' },
      { label: 'Events', value: '132' },
    ],
  },
  {
    id: 'ds3',
    name: 'Bali, Indonesia',
    coverPhotoId: '1537996194471-e657df975ab4',
    livePlanningCount: 214,
    travelerCount: 16100,
    travelerCountLabel: '16.1K travelers',
    distanceKm: 6360,
    hot: false,
    stats: [
      { label: 'Tips', value: '2.2K' },
      { label: 'Trips', value: '301' },
      { label: 'Events', value: '48' },
    ],
  },
  {
    id: 'ds4',
    name: 'Lisbon, Portugal',
    coverPhotoId: '1585208798174-6cedd86e019a',
    livePlanningCount: 168,
    travelerCount: 11700,
    travelerCountLabel: '11.7K travelers',
    distanceKm: 9330,
    hot: false,
    stats: [
      { label: 'Tips', value: '1.6K' },
      { label: 'Trips', value: '224' },
      { label: 'Events', value: '31' },
    ],
  },
  {
    id: 'ds5',
    name: 'Reykjavík, Iceland',
    coverPhotoId: '1504829857797-ddff29c27927',
    livePlanningCount: 96,
    travelerCount: 7400,
    travelerCountLabel: '7.4K travelers',
    distanceKm: 11380,
    hot: false,
    stats: [
      { label: 'Tips', value: '980' },
      { label: 'Trips', value: '141' },
      { label: 'Events', value: '18' },
    ],
  },
  {
    id: 'ds6',
    name: 'Marrakech, Morocco',
    coverPhotoId: '1539020140153-e479b8c22e70',
    livePlanningCount: 121,
    travelerCount: 9200,
    travelerCountLabel: '9.2K travelers',
    distanceKm: 7420,
    hot: false,
    stats: [
      { label: 'Tips', value: '1.1K' },
      { label: 'Trips', value: '187' },
      { label: 'Events', value: '22' },
    ],
  },
];

export const DESTINATION_CARDS: DestinationCard[] = DESTINATION_SEEDS.map(({ coverPhotoId, ...seed }) => ({
  ...seed,
  coverUrl: unsplashUrl(coverPhotoId, 700),
}));
