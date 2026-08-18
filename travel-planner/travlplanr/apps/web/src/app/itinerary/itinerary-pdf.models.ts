export type ItineraryPdfItemKind = 'flight' | 'train' | 'bus' | 'hotel' | 'activity' | 'car';

export type ItineraryPdfVariant = 'pre-booking' | 'post-booking';

export interface ItineraryPdfItem {
  kind: ItineraryPdfItemKind;
  title: string;
  subtitle?: string;
  classLabel?: string;
  refundable?: string;
  depDate?: string;
  depTime?: string;
  depLocation?: string;
  arrDate?: string;
  arrTime?: string;
  arrLocation?: string;
  duration?: string;
  stops?: string;
  cost?: string;
  rating?: number;
  location?: string;
  dates?: string;
  time?: string;
  imageUrl?: string;
  amenities?: string[];
}

export interface ItineraryPdfDay {
  day: number;
  title: string;
  dateStr: string;
  items: ItineraryPdfItem[];
}

export interface ItineraryPdfSummarySection {
  title: string;
  items: string[];
}

export interface ItineraryPdfFaqItem {
  question: string;
  answer: string;
}

export interface ItineraryPdfData {
  variant: ItineraryPdfVariant;
  tripTitle: string;
  dateRange: string;
  destinations: string;
  duration: string;
  travellers: string;
  inclusion: string;
  price: string;
  priceNote?: string;
  bookingUrl?: string;
  departureReturn: string;
  days: ItineraryPdfDay[];
  partners: string[];
  summarySections: ItineraryPdfSummarySection[];
  faqItems: ItineraryPdfFaqItem[];
}
