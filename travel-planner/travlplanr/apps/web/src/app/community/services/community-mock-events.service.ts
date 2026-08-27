import { Injectable, signal } from '@angular/core';

/**
 * UI-only event data for the Community Events surfaces (list + host wizard).
 * These mirror the shape the real /community/meetups API is expected to
 * return once that page is reconnected to the backend — see
 * CommunityEventsService for the real client. Kept as a shared, in-memory
 * store (rather than component-local state) purely so an event created in
 * the host wizard shows up back on the list without a page reload.
 */

export type EventTag = 'Meetup' | 'Food' | 'Online';

export interface EventScheduleStep {
  time: string;
  text: string;
}

export interface TripDayItem {
  time: string;
  title: string;
}

export interface TripDayOption {
  id: string;
  label: string;
  dateLabel: string;
  itemsCount: number;
  items: TripDayItem[];
}

export interface TripOption {
  id: string;
  name: string;
  dateRangeLabel: string;
  activitiesCount: number;
  days: TripDayOption[];
}

export const TRIP_OPTIONS: TripOption[] = [
  {
    id: 'trip-1',
    name: 'Paris · Long weekend',
    dateRangeLabel: 'Jun 03 – Jun 08',
    activitiesCount: 8,
    days: [
      {
        id: 'd1',
        label: 'Day 1',
        dateLabel: 'Wed 03',
        itemsCount: 2,
        items: [
          { time: '15:00', title: 'Check in · Hôtel Bachaumont' },
          { time: '19:00', title: 'Dinner in Le Marais' }
        ]
      },
      { id: 'd2', label: 'Day 2', dateLabel: 'Thu 04', itemsCount: 1, items: [{ time: '10:00', title: 'Louvre — timed entry' }] },
      {
        id: 'd3',
        label: 'Day 3',
        dateLabel: 'Fri 05',
        itemsCount: 2,
        items: [
          { time: '09:30', title: 'Eiffel Tower — summit access' },
          { time: '20:00', title: 'Seine river cruise' }
        ]
      },
      { id: 'd4', label: 'Day 4', dateLabel: 'Sat 06', itemsCount: 1, items: [{ time: '11:00', title: 'Musée d\'Orsay' }] },
      { id: 'd5', label: 'Day 5', dateLabel: 'Sun 07', itemsCount: 1, items: [{ time: '14:00', title: 'Versailles day trip' }] },
      { id: 'd6', label: 'Day 6', dateLabel: 'Mon 08', itemsCount: 1, items: [{ time: '12:00', title: 'Check out · Hôtel Bachaumont' }] }
    ]
  },
  {
    id: 'trip-2',
    name: 'Japan 2027',
    dateRangeLabel: 'Apr 04 – Apr 11',
    activitiesCount: 9,
    days: [
      { id: 'd1', label: 'Day 1', dateLabel: 'Apr 04', itemsCount: 1, items: [{ time: '16:00', title: 'Check in · Shinjuku' }] },
      {
        id: 'd2',
        label: 'Day 2',
        dateLabel: 'Apr 05',
        itemsCount: 2,
        items: [
          { time: '09:00', title: 'Senso-ji Temple' },
          { time: '19:00', title: 'Shibuya crossing at night' }
        ]
      },
      { id: 'd3', label: 'Day 3', dateLabel: 'Apr 06', itemsCount: 1, items: [{ time: '10:00', title: 'teamLab Planets' }] },
      { id: 'd4', label: 'Day 4', dateLabel: 'Apr 07', itemsCount: 1, items: [{ time: '08:00', title: 'Tsukiji Outer Market' }] }
    ]
  }
];

export interface CommunityEventCard {
  id: string;
  title: string;
  location: string;
  time: string;
  /** Human-readable length, e.g. "2h 30m". Empty when unknown (e.g. freshly hosted events). */
  duration: string;
  price: string;
  travelersGoing: number;
  month: string;
  day: string;
  tag: EventTag;
  joined: boolean;
  followed: boolean;
  imageUrl: string;
  hostName: string;
  hostRole: string;
  /** Short personalization line shown between the banner and the price row, e.g. "Because you're planning a trip to Paris". */
  reason: string;
  description: string;
  groupMax: string;
  spacesLeftBase: number;
  schedule: EventScheduleStep[];
  locationName: string;
  locationNote: string;
}

/** Mirrors the source design's unsplashUrl() helper — same crop/format params. */
export function unsplashUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

const SEED_EVENTS: CommunityEventCard[] = [
  {
    id: 'evt-1',
    title: 'Paris Photography Walk',
    location: 'Montmartre, Paris',
    time: '09:00',
    duration: '2h 30m',
    price: 'Free',
    travelersGoing: 14,
    month: 'JUN',
    day: '07',
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1499856871958-5b9627545d1a'),
    hostName: 'Camille Roy',
    hostRole: 'Local guide · hosts 2 walks a month',
    reason: "Because you're planning a trip to Paris",
    description:
      'A slow two-and-a-half hours through Montmartre before the tour groups arrive. We stop where the light is good, not where the guidebooks say.',
    groupMax: '20 max',
    spacesLeftBase: 6,
    schedule: [
      { time: '09:00', text: 'Meet at the funicular, coffee first' },
      { time: '09:30', text: "Rue de l'Abreuvoir and the back stairs" },
      { time: '10:45', text: 'Sacré-Cœur terrace as it empties' },
      { time: '11:30', text: 'Finish at Saint-Jean, optional lunch' }
    ],
    locationName: 'Funicular de Montmartre, lower station',
    locationNote: 'Any camera — phones are completely fine. Comfortable shoes; there are a lot of steps.'
  },
  {
    id: 'evt-2',
    title: 'Tokyo Ramen Meetup',
    location: 'Shinjuku, Tokyo',
    time: '19:00',
    duration: '2h 15m',
    price: '¥3,000',
    travelersGoing: 32,
    month: 'JUN',
    day: '15',
    tag: 'Food',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1540959733332-eab4deabeeaf'),
    hostName: 'Maya Kondo',
    hostRole: 'Lives in Tokyo · 6 meetups hosted',
    reason: 'Matches your interest in food',
    description:
      'Three small shops in one evening, in the order a local would do them. We queue together and split the bill at each stop.',
    groupMax: '40 max',
    spacesLeftBase: 8,
    schedule: [
      { time: '19:00', text: 'Meet at Shinjuku east exit' },
      { time: '19:20', text: 'Shop one — shio' },
      { time: '20:15', text: 'Shop two — tsukemen' },
      { time: '21:15', text: 'Shop three, standing only' }
    ],
    locationName: 'Shinjuku Station, east exit by the plaza clock',
    locationNote: 'Cash for the ticket machines. Come hungry — three bowls is the point.'
  },
  {
    id: 'evt-3',
    title: 'Planning Japan 2027 — live Q&A',
    location: 'Online',
    time: '18:00 CET',
    duration: '1h',
    price: 'Free',
    travelersGoing: 128,
    month: 'JUN',
    day: '22',
    tag: 'Online',
    joined: false,
    followed: true,
    imageUrl: unsplashUrl('1490806843957-31f4c9a91c65'),
    hostName: 'Rhea Sharma',
    hostRole: 'Travelled Japan 3 times · 2.4K saves',
    reason: 'Hosted by Rhea Sharma, who you follow',
    description:
      'An hour of open questions about routing, rail passes and cherry-blossom timing for spring 2027. Bring a half-made plan and leave with a real one.',
    groupMax: '300 max',
    spacesLeftBase: 172,
    schedule: [
      { time: '18:00', text: 'Rail passes — what is actually worth it' },
      { time: '18:20', text: 'Blossom timing by city' },
      { time: '18:40', text: 'Open questions' },
      { time: '19:00', text: 'Ends' }
    ],
    locationName: 'Link appears here 30 minutes before it starts',
    locationNote: 'Your draft itinerary, if you have one.'
  },
  {
    id: 'evt-4',
    title: 'Lisbon Sunset Miradouro Crawl',
    location: 'Graça, Lisbon',
    time: '18:30',
    duration: '2h',
    price: 'Free',
    travelersGoing: 21,
    month: 'JUL',
    day: '04',
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1585208798174-6cedd86e019a'),
    hostName: 'Iker Solano',
    hostRole: 'Lisbon local · slow travel writer',
    reason: 'Popular with travelers like you',
    description:
      'Four viewpoints, downhill the whole way, timed so you are at the last one as the light goes. Ends near the tram stop.',
    groupMax: '25 max',
    spacesLeftBase: 4,
    schedule: [
      { time: '18:30', text: 'Meet at Graça viewpoint' },
      { time: '19:10', text: 'Senhora do Monte' },
      { time: '19:50', text: 'Portas do Sol' },
      { time: '20:30', text: 'Santa Luzia for the last of the light' }
    ],
    locationName: 'Miradouro da Graça, by the kiosk',
    locationNote: 'A jacket — it gets windy up there. Kiosk drinks are cash only.'
  }
];

@Injectable({ providedIn: 'root' })
export class CommunityMockEventsService {
  readonly events = signal<CommunityEventCard[]>(SEED_EVENTS);
  private pendingToast: string | null = null;

  addEvent(card: CommunityEventCard): void {
    this.events.update((list) => [card, ...list]);
  }

  /** Set by the host wizard right before it navigates back to the list. */
  setPendingToast(message: string): void {
    this.pendingToast = message;
  }

  /** Read-once: the list page calls this on load to show a "just created" toast. */
  consumePendingToast(): string | null {
    const message = this.pendingToast;
    this.pendingToast = null;
    return message;
  }
}
