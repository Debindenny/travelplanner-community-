import { MyTripsListable, isListedInMyTrips } from './trip-listing.util';

export type TripTab = 'upcoming' | 'recent' | 'saved';

export function filterTripsForTab(
  trips: MyTripsListable[],
  tab: TripTab,
  now: Date = new Date(),
): MyTripsListable[] {
  let list = trips.filter(isListedInMyTrips);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (tab === 'upcoming') {
    list = list.filter((trip) => {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      return start >= today || (start <= today && end >= today);
    });
  } else if (tab === 'recent') {
    list = list.filter((trip) => new Date(trip.endDate) < today);
    list.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  } else {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return list;
}
