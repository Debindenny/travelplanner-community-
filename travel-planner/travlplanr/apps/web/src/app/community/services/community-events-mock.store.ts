import { Injectable, signal } from '@angular/core';
import { CommunityEventCard, unsplashUrl } from './community-event-view.model';

/**
 * Frontend-only data source for the Community Events surfaces (list, detail,
 * host wizard). No HTTP calls — everything lives in this in-memory signal so
 * the Events UI works standalone, independent of the planner backend.
 */

/** Events created via the current session's own host wizard land under this id. */
export const CURRENT_USER_ID = 'you';

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
    hostId: 'camille-roy',
    hostName: 'Camille Roy',
    hostRole: 'Local guide · hosts 2 walks a month',
    reason: "Because you're planning a trip to Paris",
    description:
      'A slow two-and-a-half hours through Montmartre before the tour groups arrive. We stop where the light is good, not where the guidebooks say.',
    groupMax: '20 max',
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
    hostId: 'maya-kondo',
    hostName: 'Maya Kondo',
    hostRole: 'Lives in Tokyo · 6 meetups hosted',
    reason: 'Matches your interest in food',
    description:
      'Three small shops in one evening, in the order a local would do them. We queue together and split the bill at each stop.',
    groupMax: '40 max',
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
    hostId: 'rhea-sharma',
    hostName: 'Rhea Sharma',
    hostRole: 'Travelled Japan 3 times · 2.4K saves',
    reason: 'Hosted by Rhea Sharma, who you follow',
    description:
      'An hour of open questions about routing, rail passes and cherry-blossom timing for spring 2027. Bring a half-made plan and leave with a real one.',
    groupMax: '300 max',
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
    hostId: 'iker-solano',
    hostName: 'Iker Solano',
    hostRole: 'Lisbon local · slow travel writer',
    reason: 'Popular with travelers like you',
    description:
      'Four viewpoints, downhill the whole way, timed so you are at the last one as the light goes. Ends near the tram stop.',
    groupMax: '25 max',
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
