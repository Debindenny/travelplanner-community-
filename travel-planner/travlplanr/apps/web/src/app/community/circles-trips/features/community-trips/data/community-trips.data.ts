export type TripTier = 'Budget' | 'Mid-range' | 'Luxury';

/** A real, clonable sample itinerary shown on the community "Trips" browse
 * page — backed by `GET /api/v1/community/trips/templates` (real `trips`
 * rows flagged `is_template=true`, see services/planner alembic
 * 0034_trip_templates), not mock data.
 */
export interface CommunityTrip {
  id: string;
  title: string;
  destination: string;
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
  isSaved: boolean;
}
