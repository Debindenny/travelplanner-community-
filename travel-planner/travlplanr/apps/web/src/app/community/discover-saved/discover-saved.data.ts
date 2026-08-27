import { ItineraryDay, TripPickOption } from './discover-saved.models';

function unsplashUrl(photoId: string, width = 600): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

const AVATAR_PHOTO_IDS = [
  '1494790108377-be9c29b29330',
  '1507003211169-0a1dd7228f2d',
  '1438761681033-6461ffad8d80',
  '1500648767791-00dcc994a43e',
  '1534528741775-53994a69daeb',
  '1506794778202-cad84cf45f1d',
  '1544005313-94ddf0286df2',
  '1519085360753-af0119f7cbe7',
  '1517841905240-472988babdf9',
  '1531123897727-8f129e1688ce',
];

/** Deterministically picks a portrait-ish stock photo for a seed string. */
export function avatarPhotoUrl(seed: string, width = 200): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return unsplashUrl(AVATAR_PHOTO_IDS[hash % AVATAR_PHOTO_IDS.length], width);
}

// Trip pick / itinerary data stays local mock data — the Discover and Saved
// backend endpoints don't cover Trips/itineraries, so "Add to trip" keeps
// working against this fixture rather than a real trip-planning API.
export const TRIP_PICK_OPTIONS: TripPickOption[] = [
  { id: 't1', name: 'Paris · Long weekend', dates: 'Jun 03 – Jun 06 · 4 activities' },
  { id: 't2', name: 'Japan 2027', dates: 'Apr 04 – Apr 11 · 9 activities' },
];

export const TRIP_ITINERARIES: Record<string, ItineraryDay[]> = {
  t1: [
    { date: 'Jun 03', items: [{ time: '15:00', name: 'Check in · Hôtel Bachaumont' }, { time: '19:00', name: 'Dinner in Le Marais' }] },
    { date: 'Jun 04', items: [{ time: '09:30', name: 'Louvre · Denon wing' }] },
    { date: 'Jun 05', items: [{ time: '10:00', name: 'Montmartre walk' }, { time: '20:30', name: 'Seine at dusk' }] },
    { date: 'Jun 06', items: [{ time: '11:00', name: 'Flight home · CDG' }] },
  ],
  t2: [
    { date: 'Apr 04', items: [{ time: '14:00', name: 'Land · Haneda' }] },
    { date: 'Apr 05', items: [{ time: '09:00', name: 'Shibuya + Harajuku' }, { time: '17:30', name: 'Shibuya Sky' }] },
    { date: 'Apr 06', items: [{ time: '08:00', name: 'Shinkansen to Kyoto' }] },
    { date: 'Apr 07', items: [{ time: '10:00', name: 'Fushimi Inari' }] },
  ],
};
