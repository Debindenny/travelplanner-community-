/** Minimal trip shape for My Trips visibility rules (no Angular deps — testable in Node). */
export interface MyTripsListable {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  image?: string;
  customizations?: { savedToMyTrips?: boolean; [key: string]: unknown };
}

/** Trips appear once generated, saved, pending, or booked, unless explicitly terminal. */
export function isListedInMyTrips(trip: MyTripsListable): boolean {
  if (trip.customizations?.savedToMyTrips === true) return true;
  return ['booked', 'pending', 'ready', 'created', 'generating'].includes(trip.status);
}
