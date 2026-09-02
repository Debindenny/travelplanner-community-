import { unsplashUrl } from '../../../shared/utils/unsplash';
import { mockCustomerId } from '../../../core/data/community-mock-users';

export type TripTier = 'Budget' | 'Mid-range' | 'Luxury';

export interface CommunityTrip {
  id: string;
  title: string;
  subtitle: string;
  tier: TripTier;
  saves: string;
  image: string;
  author: string;
  customer_id: string;
  updated: string;
  days: number;
  cities: number;
  activities: number;
  perPerson: string;
}

export const COMMUNITY_TRIPS: CommunityTrip[] = [
  {
    id: 't1',
    title: '7 Days in Japan',
    subtitle: 'Cherry-blossom season · Mid-range · Couple',
    tier: 'Mid-range',
    saves: '2.4K saves',
    image: unsplashUrl('1493976040374-85c8e12f0c0e', 900),
    author: 'Rhea Sharma',
    customer_id: mockCustomerId('Rhea Sharma'),
    updated: 'Updated 2d ago',
    days: 7,
    cities: 3,
    activities: 12,
    perPerson: '₹1.4L',
  },
  {
    id: 't2',
    title: '5 Days in Lisbon & Sintra',
    subtitle: 'Shoulder season · Budget · Solo',
    tier: 'Budget',
    saves: '1.8K saves',
    image: unsplashUrl('1503756234508-e32d1769ee16', 900),
    author: 'Iker Solano',
    customer_id: mockCustomerId('Iker Solano'),
    updated: 'Updated 5d ago',
    days: 5,
    cities: 2,
    activities: 9,
    perPerson: '€620',
  },
  {
    id: 't3',
    title: 'Europe by Train · 14 Days',
    subtitle: 'Summer · Budget · Couple',
    tier: 'Budget',
    saves: '1.2K saves',
    image: unsplashUrl('1467269204594-9661b134dd2b', 900),
    author: 'Marco Villa',
    customer_id: mockCustomerId('Marco Villa'),
    updated: 'Updated 1w ago',
    days: 14,
    cities: 6,
    activities: 21,
    perPerson: '€1.9K',
  },
  {
    id: 't4',
    title: 'Paris Long Weekend',
    subtitle: 'Spring · Mid-range · Solo',
    tier: 'Mid-range',
    saves: '940 saves',
    image: unsplashUrl('1502602898657-3e91760cbb34', 900),
    author: 'Emma Ross',
    customer_id: mockCustomerId('Emma Ross'),
    updated: 'Updated 3d ago',
    days: 4,
    cities: 1,
    activities: 8,
    perPerson: '£540',
  },
];
