/**
 * ItineraryRow — typed interface matching the current itinerary.component.ts literal shape.
 */
export interface ItineraryRow {
  id: string;
  displayCode: string;
  customerName: string;
  customerId: string;
  destination: string;
  duration: string;
  travelDates: string;
  traveler: string;
  type: string;
  status: 'Created' | 'Pending' | 'Booked' | 'Cancelled' | string;
  departureReturn: string;
  title: string;
  curator: string;
  curatorPhone: string;
  collaboratorsCount?: number;
  customerAvatar?: string;
}
/** Itinerary KPIs — adds the missing Booked card */
export interface ItineraryKpis {
  total: number;
  pending: number;
  created: number;
  booked: number;
}

/** Itinerary list API response */
export interface ItineraryApiResponse {
  kpis: ItineraryKpis;
  items: any[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
