import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type EventsFilter = 'all' | 'near-me' | 'online';
type EventTag = 'Meetup' | 'Food' | 'Online';

interface EventScheduleStep {
  time: string;
  text: string;
}

interface CommunityEventCard {
  id: string;
  title: string;
  location: string;
  time: string;
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
  description: string;
  groupMax: string;
  spacesLeftBase: number;
  schedule: EventScheduleStep[];
  locationName: string;
  locationNote: string;
}

interface TripDayOption {
  id: string;
  label: string;
  dateLabel: string;
  itemsCount: number;
}

interface TripOption {
  id: string;
  name: string;
  dateRangeLabel: string;
  activitiesCount: number;
  days: TripDayOption[];
}

/** Mirrors the source design's unsplashUrl() helper — same crop/format params. */
function unsplashUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

@Component({
  selector: 'app-community-events',
  imports: [CommonModule, RouterLink],
  templateUrl: './community-events.component.html'
})
export class CommunityEventsComponent {
  activeFilter: EventsFilter = 'all';
  selectedEvent: CommunityEventCard | null = null;
  addToTripEvent: CommunityEventCard | null = null;
  selectedTripId = '';
  selectedDayId = '';
  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly filters: { value: EventsFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'near-me', label: 'Near me' },
    { value: 'online', label: 'Online' }
  ];

  readonly tripOptions: TripOption[] = [
    {
      id: 'trip-1',
      name: 'Paris · Long weekend',
      dateRangeLabel: 'Jun 03 – Jun 06',
      activitiesCount: 4,
      days: [
        { id: 'd1', label: 'Day 1', dateLabel: 'Wed 03', itemsCount: 2 },
        { id: 'd2', label: 'Day 2', dateLabel: 'Thu 04', itemsCount: 1 },
        { id: 'd3', label: 'Day 3', dateLabel: 'Fri 05', itemsCount: 2 },
        { id: 'd4', label: 'Day 4', dateLabel: 'Sat 06', itemsCount: 1 }
      ]
    },
    {
      id: 'trip-2',
      name: 'Japan 2027',
      dateRangeLabel: 'Apr 04 – Apr 11',
      activitiesCount: 9,
      days: [
        { id: 'd1', label: 'Day 1', dateLabel: 'Apr 04', itemsCount: 1 },
        { id: 'd2', label: 'Day 2', dateLabel: 'Apr 05', itemsCount: 2 },
        { id: 'd3', label: 'Day 3', dateLabel: 'Apr 06', itemsCount: 1 },
        { id: 'd4', label: 'Day 4', dateLabel: 'Apr 07', itemsCount: 1 }
      ]
    }
  ];

  events: CommunityEventCard[] = [
    {
      id: 'evt-1',
      title: 'Paris Photography Walk',
      location: 'Montmartre, Paris',
      time: '09:00',
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
      price: 'Free',
      travelersGoing: 128,
      month: 'JUN',
      day: '22',
      tag: 'Online',
      joined: false,
      followed: false,
      imageUrl: unsplashUrl('1490806843957-31f4c9a91c65'),
      hostName: 'Rhea Sharma',
      hostRole: 'Travelled Japan 3 times · 2.4K saves',
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

  setFilter(filter: EventsFilter): void {
    this.activeFilter = filter;
  }

  get visibleEvents(): CommunityEventCard[] {
    if (this.activeFilter === 'online') return this.events.filter((ev) => ev.tag === 'Online');
    if (this.activeFilter === 'near-me') return this.events.filter((ev) => ev.tag !== 'Online');
    return this.events;
  }

  openDetails(ev: CommunityEventCard): void {
    this.selectedEvent = ev;
  }

  closeDetails(): void {
    this.selectedEvent = null;
  }

  toggleJoin(ev: CommunityEventCard): void {
    ev.joined = !ev.joined;
    ev.travelersGoing += ev.joined ? 1 : -1;
    if (ev.joined) {
      const destination = ev.tag === 'Online' ? 'added to your calendar' : 'added to your trip itinerary';
      this.showToast(`You're going · ${destination}`);
    } else {
      this.showToast(`Spot released · ${ev.title}`);
    }
  }

  toggleFollow(ev: CommunityEventCard): void {
    ev.followed = !ev.followed;
    this.showToast(ev.followed ? `Following ${ev.hostName}` : `Unfollowed ${ev.hostName}`);
  }

  seeWho(ev: CommunityEventCard): void {
    const label = ev.travelersGoing === 1 ? 'traveler' : 'travelers';
    this.showToast(`Attendee list · ${ev.travelersGoing} ${label} going`);
  }

  spacesLeft(ev: CommunityEventCard): number {
    return Math.max(0, ev.spacesLeftBase - (ev.joined ? 1 : 0));
  }

  get selectedTrip(): TripOption {
    return this.tripOptions.find((t) => t.id === this.selectedTripId) ?? this.tripOptions[0];
  }

  get selectedDay(): TripDayOption {
    return this.selectedTrip.days.find((d) => d.id === this.selectedDayId) ?? this.selectedTrip.days[0];
  }

  openAddToTrip(ev: CommunityEventCard): void {
    this.addToTripEvent = ev;
    this.selectedTripId = this.tripOptions[0].id;
    this.selectedDayId = this.tripOptions[0].days[0].id;
  }

  closeAddToTrip(): void {
    this.addToTripEvent = null;
    this.selectedEvent = null;
  }

  selectTrip(tripId: string): void {
    this.selectedTripId = tripId;
    const trip = this.tripOptions.find((t) => t.id === tripId);
    this.selectedDayId = trip ? trip.days[0].id : '';
  }

  selectDay(dayId: string): void {
    this.selectedDayId = dayId;
  }

  confirmAddToTrip(): void {
    if (!this.addToTripEvent) return;
    const trip = this.selectedTrip;
    const day = this.selectedDay;
    this.closeAddToTrip();
    this.showToast(`Added to ${trip.name} · ${day.label}, ${day.dateLabel}`);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 2500);
  }
}
