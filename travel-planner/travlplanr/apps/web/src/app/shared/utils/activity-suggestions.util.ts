export type SuggestedActivitySlot = 'Morning' | 'Noon' | 'Afternoon' | 'Evening' | 'Night' | 'Halfday' | 'Fullday';

export interface SuggestedActivity {
  title: string;
  timeOfDay: SuggestedActivitySlot;
  duration: string;
  attractionType: string;
}

/** Map suggestion slots to itinerary activity time-of-day labels. */
export function toItineraryTimeSlot(slot: SuggestedActivitySlot): 'Morning' | 'Noon' | 'Evening' | 'Night' | 'Halfday' | 'Fullday' {
  if (slot === 'Afternoon') return 'Noon';
  return slot;
}

/** Curated fallbacks when inventory search returns too few matches. */
const SUGGESTIONS_BY_CITY: Record<string, SuggestedActivity[]> = {
  dubai: [
    { title: 'Burj Khalifa At the Top', timeOfDay: 'Morning', duration: '2 hours', attractionType: 'Landmark' },
    { title: 'Desert Safari & Dune Bashing', timeOfDay: 'Evening', duration: '5 hours', attractionType: 'Adventure' },
    { title: 'Dubai Marina Yacht Cruise', timeOfDay: 'Evening', duration: '2 hours', attractionType: 'Cruise' },
    { title: 'Old Dubai Souks & Abra Ride', timeOfDay: 'Morning', duration: '3 hours', attractionType: 'Culture' },
    { title: 'Dubai Mall & Fountain Show', timeOfDay: 'Afternoon', duration: '3 hours', attractionType: 'Shopping' },
    { title: 'Palm Jumeirah & Atlantis Visit', timeOfDay: 'Noon', duration: '4 hours', attractionType: 'Sightseeing' },
  ],
  'abu dhabi': [
    { title: 'Sheikh Zayed Grand Mosque Tour', timeOfDay: 'Morning', duration: '2 hours', attractionType: 'Culture' },
    { title: 'Louvre Abu Dhabi', timeOfDay: 'Afternoon', duration: '3 hours', attractionType: 'Museum' },
    { title: 'Yas Island Theme Park', timeOfDay: 'Fullday', duration: '6 hours', attractionType: 'Theme Park' },
    { title: 'Corniche Sunset Walk', timeOfDay: 'Evening', duration: '2 hours', attractionType: 'Leisure' },
  ],
  paris: [
    { title: 'Eiffel Tower Summit Visit', timeOfDay: 'Morning', duration: '2 hours', attractionType: 'Landmark' },
    { title: 'Louvre Museum Highlights', timeOfDay: 'Afternoon', duration: '3 hours', attractionType: 'Museum' },
    { title: 'Seine River Dinner Cruise', timeOfDay: 'Evening', duration: '2 hours', attractionType: 'Cruise' },
    { title: 'Montmartre & Sacré-Cœur Walk', timeOfDay: 'Morning', duration: '3 hours', attractionType: 'Culture' },
  ],
  tokyo: [
    { title: 'Senso-ji Temple & Asakusa Walk', timeOfDay: 'Morning', duration: '2 hours', attractionType: 'Culture' },
    { title: 'Shibuya & Harajuku Tour', timeOfDay: 'Afternoon', duration: '3 hours', attractionType: 'City' },
    { title: 'Tsukiji Outer Market Food Tour', timeOfDay: 'Morning', duration: '2 hours', attractionType: 'Food' },
    { title: 'TeamLab Borderless', timeOfDay: 'Evening', duration: '2 hours', attractionType: 'Art' },
  ],
  bali: [
    { title: 'Ubud Rice Terraces & Temple Tour', timeOfDay: 'Fullday', duration: '6 hours', attractionType: 'Nature' },
    { title: 'Tanah Lot Sunset Temple', timeOfDay: 'Evening', duration: '3 hours', attractionType: 'Temple' },
    { title: 'Balinese Cooking Class', timeOfDay: 'Morning', duration: '3 hours', attractionType: 'Food' },
    { title: 'Seminyak Beach & Spa', timeOfDay: 'Afternoon', duration: '4 hours', attractionType: 'Relaxation' },
  ],
  singapore: [
    { title: 'Gardens by the Bay', timeOfDay: 'Morning', duration: '3 hours', attractionType: 'Nature' },
    { title: 'Marina Bay Sands SkyPark', timeOfDay: 'Afternoon', duration: '2 hours', attractionType: 'Landmark' },
    { title: 'Chinatown Heritage Trail', timeOfDay: 'Morning', duration: '2 hours', attractionType: 'Culture' },
    { title: 'Night Safari Experience', timeOfDay: 'Night', duration: '3 hours', attractionType: 'Wildlife' },
  ],
};

const CITY_IMAGE_KEYWORDS: Record<string, string> = {
  dubai: 'assets/images/landing/iconic-uae.jpg',
  uae: 'assets/images/landing/iconic-uae.jpg',
  'abu dhabi': 'assets/images/landing/journey-abudhabi.jpg',
  paris: 'assets/images/landing/figma/france.jpg',
  france: 'assets/images/landing/figma/france.jpg',
  tokyo: 'assets/images/landing/japan.jpg',
  japan: 'assets/images/landing/japan.jpg',
  bali: 'assets/images/landing/package-bali.jpg',
  singapore: 'assets/images/landing/singapore.jpg',
  thailand: 'assets/images/landing/thailand.jpg',
  london: 'assets/images/landing/europe-london.jpg',
  switzerland: 'assets/images/landing/iconic-switzerland.jpg',
  maldives: 'assets/images/landing/maldives.jpg',
};

function normalizeCityKey(city: string): string {
  return city.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

export function getSuggestedActivitiesForCity(city: string, limit = 8): SuggestedActivity[] {
  const norm = normalizeCityKey(city);
  if (SUGGESTIONS_BY_CITY[norm]) {
    return SUGGESTIONS_BY_CITY[norm].slice(0, limit);
  }
  for (const [key, list] of Object.entries(SUGGESTIONS_BY_CITY)) {
    if (norm.includes(key) || key.includes(norm)) {
      return list.slice(0, limit);
    }
  }
  return [
    { title: `${city} City Highlights Tour`, timeOfDay: 'Morning' as const, duration: '3 hours', attractionType: 'Sightseeing' },
    { title: `${city} Local Food Experience`, timeOfDay: 'Evening' as const, duration: '2 hours', attractionType: 'Food' },
    { title: `${city} Cultural Walking Tour`, timeOfDay: 'Afternoon' as const, duration: '2 hours', attractionType: 'Culture' },
    { title: `${city} Sunset Viewpoint`, timeOfDay: 'Evening' as const, duration: '2 hours', attractionType: 'Scenic' },
  ].slice(0, limit);
}

export function activityImageForCity(city: string): string | null {
  const norm = normalizeCityKey(city);
  if (CITY_IMAGE_KEYWORDS[norm]) return CITY_IMAGE_KEYWORDS[norm];
  for (const [key, url] of Object.entries(CITY_IMAGE_KEYWORDS)) {
    if (norm.includes(key)) return url;
  }
  return null;
}
