import { Injectable, signal } from '@angular/core';
import { CommunityEventCard, JourneyDay, unsplashUrl } from './community-event-view.model';

/**
 * Frontend-only data source for the Community Events surfaces (list, detail,
 * host wizard). No HTTP calls — everything lives in this in-memory signal so
 * the Events UI works standalone, independent of the planner backend.
 */

/** Events created via the current session's own host wizard land under this id. */
export const CURRENT_USER_ID = 'you';

const GUIDE_AVATAR_1 = unsplashUrl('1633332755192-727a05c4013d', 200);
const GUIDE_AVATAR_2 = unsplashUrl('1607990281513-2c110a25bd8c', 200);
const GUIDE_AVATAR_3 = unsplashUrl('1502685104226-ee32379fefbe', 200);

const TRAVELER_AVATARS = [
  unsplashUrl('1500648767791-00dcc994a43e', 100),
  unsplashUrl('1544005313-94ddf0286df2', 100),
  unsplashUrl('1524504388940-b1c1722653e1', 100),
  unsplashUrl('1519085360753-af0119f7cbe7', 100)
];

const MONTH_INDEX: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

/** Lays out a journey's per-day itinerary/pricing sequentially from a start date, city block by city block. */
function buildJourneyDays(
  startMonth: string,
  startDay: number,
  segments: { city: string; days: { activities: string[]; price: number }[] }[]
): JourneyDay[] {
  const start = new Date(2026, MONTH_INDEX[startMonth], startDay);
  let dayNum = 1;
  const result: JourneyDay[] = [];
  for (const segment of segments) {
    for (const day of segment.days) {
      const date = new Date(start);
      date.setDate(start.getDate() + (dayNum - 1));
      result.push({
        day: dayNum,
        city: segment.city,
        dateLabel: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        price: day.price,
        activities: day.activities
      });
      dayNum++;
    }
  }
  return result;
}

const SEED_EVENTS: CommunityEventCard[] = [
  {
    id: 'evt-1',
    title: 'European Summer Adventure',
    subtitle: 'Paris, Barcelona And Madrid Theme Journey',
    location: 'Paris, France',
    time: '09:00',
    duration: '',
    price: '$2,450',
    travelersGoing: 12,
    travelersMax: 20,
    rating: 4.0,
    reviewCount: 48,
    travelerAvatars: TRAVELER_AVATARS.slice(0, 3),
    month: 'JUN',
    day: '03',
    dateRangeLabel: '03 - 12 JUN',
    nights: 9,
    partialJoinAllowed: true,
    cities: ['Paris', 'Barcelona', 'Madrid'],
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1502602898657-3e91760cbb34'),
    hostId: 'guide-elena',
    hostName: 'Liam K.',
    hostAvatarUrl: GUIDE_AVATAR_1,
    hostRole: 'Certified Guide',
    reason: 'Popular with travelers like you',
    description:
      'Nine nights across Paris, Barcelona and Madrid — museums and markets by day, tapas and terraces by night. A relaxed pace built for first-time Europe trips.',
    groupMax: '20 max',
    baseFee: 10000,
    minConsecutiveDays: 2,
    maxConsecutiveDays: 5,
    interestTags: ['Culture', 'Food', 'Adventure'],
    days: buildJourneyDays('JUN', 3, [
      { city: 'Paris', days: [
        { activities: ['Arrival', 'Eiffel Tower at sunset'], price: 8500 },
        { activities: ['Louvre', 'Seine river cruise'], price: 7800 },
        { activities: ['Montmartre walk', 'Free evening'], price: 6200 }
      ]},
      { city: 'Barcelona', days: [
        { activities: ['Flight to Barcelona', 'Gothic Quarter'], price: 9100 },
        { activities: ['Sagrada Família', 'Park Güell'], price: 7600 },
        { activities: ['Beach day', 'Tapas crawl'], price: 6900 }
      ]},
      { city: 'Madrid', days: [
        { activities: ['Train to Madrid', 'Retiro Park'], price: 8200 },
        { activities: ['Prado Museum', 'Flamenco night'], price: 7400 },
        { activities: ['Free morning', 'Departure'], price: 5200 }
      ]}
    ]),
    schedule: [
      { time: '', text: 'Days 1-3 — Paris: Louvre, Montmartre, Seine cruise' },
      { time: '', text: 'Days 4-6 — Barcelona: Sagrada Família, Gothic Quarter, beach day' },
      { time: '', text: 'Days 7-9 — Madrid: Prado, Retiro Park, flamenco night' }
    ],
    locationName: 'Paris',
    locationNote: 'Comfortable walking shoes and a light jacket for evenings.'
  },
  {
    id: 'evt-2',
    title: 'Mediterranean Coastal Escape',
    subtitle: 'Rome, Amalfi And Palermo Theme Journey',
    location: 'Rome, Italy',
    time: '10:00',
    duration: '',
    price: '$2,890',
    travelersGoing: 8,
    travelersMax: 15,
    rating: 4.6,
    reviewCount: 32,
    travelerAvatars: TRAVELER_AVATARS.slice(1, 4),
    month: 'JUN',
    day: '18',
    dateRangeLabel: '18 - 27 JUN',
    nights: 9,
    partialJoinAllowed: true,
    cities: ['Rome', 'Amalfi', 'Palermo'],
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1533105079780-92b9be482077'),
    hostId: 'guide-marco',
    hostName: 'Marco R.',
    hostAvatarUrl: GUIDE_AVATAR_2,
    hostRole: 'Certified Guide',
    reason: 'Matches your interest in coastal trips',
    description:
      'A slow loop down the coast — ruins in Rome, cliffside towns on the Amalfi Coast, and Sicilian wine country in Palermo. Built for travelers who want the water in view most days.',
    groupMax: '15 max',
    baseFee: 12000,
    minConsecutiveDays: 2,
    maxConsecutiveDays: 5,
    interestTags: ['Coastal', 'Relaxed', 'Wine Tasting'],
    days: buildJourneyDays('JUN', 18, [
      { city: 'Rome', days: [
        { activities: ['Arrival', 'Colosseum at sunset'], price: 9200 },
        { activities: ['Vatican Museums', 'Trastevere dinner'], price: 8100 },
        { activities: ['Day trip to Tivoli'], price: 7300 }
      ]},
      { city: 'Amalfi', days: [
        { activities: ['Drive to Amalfi', 'Positano viewpoint'], price: 9600 },
        { activities: ['Ravello gardens', 'Boat day'], price: 8800 },
        { activities: ['Free beach morning', 'Limoncello tasting'], price: 6700 }
      ]},
      { city: 'Palermo', days: [
        { activities: ['Ferry to Palermo', 'Street food market'], price: 7900 },
        { activities: ['Wine tasting', 'Coastline drive'], price: 7100 },
        { activities: ['Free morning', 'Departure'], price: 5400 }
      ]}
    ]),
    schedule: [
      { time: '', text: 'Days 1-3 — Rome: Colosseum, Trastevere, day trip to Tivoli' },
      { time: '', text: 'Days 4-6 — Amalfi: Positano, Ravello, boat day' },
      { time: '', text: 'Days 7-9 — Palermo: markets, wine tasting, coastline drive' }
    ],
    locationName: 'Rome',
    locationNote: 'Swimwear and sun protection — several stops are beach or boat days.'
  },
  {
    id: 'evt-3',
    title: 'Kyoto Autumn Retreat',
    subtitle: 'Kyoto Heritage And Nature Theme Journey',
    location: 'Kyoto, Japan',
    time: '09:30',
    duration: '',
    price: '$3,150',
    travelersGoing: 14,
    travelersMax: 18,
    rating: 4.8,
    reviewCount: 61,
    travelerAvatars: TRAVELER_AVATARS.slice(0, 3),
    month: 'OCT',
    day: '12',
    dateRangeLabel: '12 - 20 OCT',
    nights: 8,
    partialJoinAllowed: false,
    cities: ['Kyoto'],
    tag: 'Meetup',
    joined: false,
    followed: true,
    imageUrl: unsplashUrl('1493707553966-283afac8c358'),
    hostId: 'guide-hana',
    hostName: 'Hana S.',
    hostAvatarUrl: GUIDE_AVATAR_3,
    hostRole: 'Certified Guide',
    reason: 'Hosted by a guide you follow',
    description:
      'Eight nights based in Kyoto during peak autumn colour — temple gardens, tea ceremonies and quiet mornings before the crowds arrive.',
    groupMax: '18 max',
    baseFee: 8000,
    interestTags: ['Heritage', 'Nature', 'Slow Travel'],
    days: buildJourneyDays('OCT', 12, [
      { city: 'Kyoto', days: [
        { activities: ['Arrival', 'Gion evening walk'], price: 8900 },
        { activities: ['Fushimi Inari torii gates'], price: 7200 },
        { activities: ['Arashiyama bamboo grove', 'Tea ceremony'], price: 8300 },
        { activities: ['Kinkaku-ji', 'Ryoan-ji rock garden'], price: 7600 },
        { activities: ['Philosopher’s Path', 'Nishiki Market'], price: 6800 },
        { activities: ['Nara day trip', 'Deer Park'], price: 7900 },
        { activities: ['Free day', 'Optional kaiseki dinner'], price: 6100 },
        { activities: ['Closing dinner', 'Departure'], price: 5300 }
      ]}
    ]),
    schedule: [
      { time: '', text: 'Days 1-3 — Fushimi Inari, Arashiyama bamboo grove, tea ceremony' },
      { time: '', text: 'Days 4-6 — Kinkaku-ji, Philosopher’s Path, Nishiki Market' },
      { time: '', text: 'Days 7-8 — Nara day trip, free day, closing dinner' }
    ],
    locationName: 'Kyoto',
    locationNote: 'Layers for cool mornings — most days involve a lot of walking.'
  },
  {
    id: 'evt-4',
    title: 'European Summer Adventure (Winter Edition)',
    subtitle: 'Paris, Barcelona And Madrid Theme Journey',
    location: 'Paris, France',
    time: '09:00',
    duration: '',
    price: '$2,650',
    travelersGoing: 10,
    travelersMax: 20,
    rating: 4.2,
    reviewCount: 19,
    travelerAvatars: TRAVELER_AVATARS.slice(0, 3),
    month: 'DEC',
    day: '12',
    dateRangeLabel: '12 - 21 DEC',
    nights: 9,
    partialJoinAllowed: true,
    cities: ['Paris', 'Barcelona', 'Madrid'],
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1431274172761-fca41d930114'),
    hostId: 'guide-elena',
    hostName: 'Liam K.',
    hostAvatarUrl: GUIDE_AVATAR_1,
    hostRole: 'Certified Guide',
    reason: 'Popular with travelers like you',
    description:
      'The same Paris–Barcelona–Madrid route, timed for winter markets, fewer crowds and holiday lights instead of summer heat.',
    groupMax: '20 max',
    baseFee: 10000,
    minConsecutiveDays: 2,
    maxConsecutiveDays: 5,
    interestTags: ['Culture', 'Food', 'Adventure'],
    days: buildJourneyDays('DEC', 12, [
      { city: 'Paris', days: [
        { activities: ['Arrival', 'Christmas market at Tuileries'], price: 8700 },
        { activities: ['Louvre', 'Seine river cruise'], price: 7900 },
        { activities: ['Montmartre walk', 'Free evening'], price: 6300 }
      ]},
      { city: 'Barcelona', days: [
        { activities: ['Flight to Barcelona', 'Gothic Quarter lights'], price: 9200 },
        { activities: ['Sagrada Família', 'Park Güell'], price: 7700 },
        { activities: ['Tapas crawl', 'Free evening'], price: 6900 }
      ]},
      { city: 'Madrid', days: [
        { activities: ['Train to Madrid', 'Retiro Park'], price: 8300 },
        { activities: ['Prado Museum', 'Flamenco night'], price: 7500 },
        { activities: ['Free morning', 'Departure'], price: 5300 }
      ]}
    ]),
    schedule: [
      { time: '', text: 'Days 1-3 — Paris: Christmas markets, Louvre, Montmartre' },
      { time: '', text: 'Days 4-6 — Barcelona: Gothic Quarter, tapas crawl' },
      { time: '', text: 'Days 7-9 — Madrid: Prado, Retiro Park, flamenco night' }
    ],
    locationName: 'Paris',
    locationNote: 'Warm layers — this edition runs through European winter.'
  },
  {
    id: 'evt-5',
    title: 'Mediterranean Coastal Escape (Winter Edition)',
    subtitle: 'Rome, Amalfi And Palermo Theme Journey',
    location: 'Rome, Italy',
    time: '10:00',
    duration: '',
    price: '$2,750',
    travelersGoing: 6,
    travelersMax: 15,
    rating: 4.4,
    reviewCount: 14,
    travelerAvatars: TRAVELER_AVATARS.slice(1, 4),
    month: 'DEC',
    day: '12',
    dateRangeLabel: '12 - 21 DEC',
    nights: 9,
    partialJoinAllowed: true,
    cities: ['Rome', 'Amalfi', 'Palermo'],
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1543429257-14b1c34d4b0e'),
    hostId: 'guide-marco',
    hostName: 'Marco R.',
    hostAvatarUrl: GUIDE_AVATAR_2,
    hostRole: 'Certified Guide',
    reason: 'Matches your interest in coastal trips',
    description:
      'Quieter coastal towns, off-season prices, and the same Rome–Amalfi–Palermo loop without the summer crowds.',
    groupMax: '15 max',
    baseFee: 12000,
    minConsecutiveDays: 2,
    maxConsecutiveDays: 5,
    interestTags: ['Coastal', 'Relaxed', 'Wine Tasting'],
    days: buildJourneyDays('DEC', 12, [
      { city: 'Rome', days: [
        { activities: ['Arrival', 'Colosseum'], price: 8900 },
        { activities: ['Vatican Museums', 'Trastevere dinner'], price: 7900 },
        { activities: ['Day trip to Tivoli'], price: 7000 }
      ]},
      { city: 'Amalfi', days: [
        { activities: ['Drive to Amalfi', 'Positano viewpoint'], price: 9100 },
        { activities: ['Ravello gardens'], price: 8300 },
        { activities: ['Coastal walk', 'Limoncello tasting'], price: 6400 }
      ]},
      { city: 'Palermo', days: [
        { activities: ['Ferry to Palermo', 'Street food market'], price: 7500 },
        { activities: ['Wine tasting', 'Coastline drive'], price: 6800 },
        { activities: ['Free morning', 'Departure'], price: 5100 }
      ]}
    ]),
    schedule: [
      { time: '', text: 'Days 1-3 — Rome: Colosseum, Trastevere' },
      { time: '', text: 'Days 4-6 — Amalfi: Positano, Ravello' },
      { time: '', text: 'Days 7-9 — Palermo: markets, wine tasting' }
    ],
    locationName: 'Rome',
    locationNote: 'A warm coat — coastal winter winds can be sharp.'
  },
  {
    id: 'evt-6',
    title: 'Kyoto Autumn Retreat (Winter Edition)',
    subtitle: 'Kyoto Heritage And Nature Theme Journey',
    location: 'Kyoto, Japan',
    time: '09:30',
    duration: '',
    price: '$3,050',
    travelersGoing: 9,
    travelersMax: 18,
    rating: 4.7,
    reviewCount: 22,
    travelerAvatars: TRAVELER_AVATARS.slice(0, 3),
    month: 'DEC',
    day: '12',
    dateRangeLabel: '12 - 21 DEC',
    nights: 9,
    partialJoinAllowed: false,
    cities: ['Kyoto'],
    tag: 'Meetup',
    joined: false,
    followed: false,
    imageUrl: unsplashUrl('1478436127897-769e1b3f0f36'),
    hostId: 'guide-hana',
    hostName: 'Hana S.',
    hostAvatarUrl: GUIDE_AVATAR_3,
    hostRole: 'Certified Guide',
    reason: 'Hosted by a guide you follow',
    description:
      'Kyoto under snow — the same temple gardens and tea houses, quieter still and dusted in white.',
    baseFee: 8000,
    groupMax: '18 max',
    interestTags: ['Heritage', 'Nature', 'Slow Travel'],
    days: buildJourneyDays('DEC', 12, [
      { city: 'Kyoto', days: [
        { activities: ['Arrival', 'Gion evening walk'], price: 8600 },
        { activities: ['Fushimi Inari torii gates in snow'], price: 7100 },
        { activities: ['Arashiyama bamboo grove', 'Tea ceremony'], price: 8000 },
        { activities: ['Kinkaku-ji under snow'], price: 7400 },
        { activities: ['Philosopher’s Path', 'Nishiki Market'], price: 6600 },
        { activities: ['Nara day trip', 'Deer Park'], price: 7700 },
        { activities: ['Free day', 'Optional kaiseki dinner'], price: 6000 },
        { activities: ['Closing dinner', 'Departure'], price: 5200 }
      ]}
    ]),
    schedule: [
      { time: '', text: 'Days 1-3 — Kinkaku-ji, Arashiyama, tea ceremony' },
      { time: '', text: 'Days 4-6 — Fushimi Inari, Nishiki Market' },
      { time: '', text: 'Days 7-9 — Nara day trip, closing dinner' }
    ],
    locationName: 'Kyoto',
    locationNote: 'Snow boots recommended — several stops involve uneven, icy paths.'
  }
];

@Injectable({ providedIn: 'root' })
export class CommunityEventsMockStore {
  readonly events = signal<CommunityEventCard[]>(SEED_EVENTS);
  private pendingToast: string | null = null;

  getById(id: string): CommunityEventCard | null {
    return this.events().find((e) => e.id === id) ?? null;
  }

  addEvent(card: CommunityEventCard): void {
    this.events.update((list) => [card, ...list]);
  }

  /** Returns the new joined state. */
  toggleJoin(id: string): boolean {
    let joined = false;
    this.events.update((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        joined = !e.joined;
        return { ...e, joined, travelersGoing: e.travelersGoing + (joined ? 1 : -1) };
      })
    );
    return joined;
  }

  /** Returns the new followed state. */
  toggleFollow(id: string): boolean {
    let followed = false;
    this.events.update((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        followed = !e.followed;
        return { ...e, followed };
      })
    );
    return followed;
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
