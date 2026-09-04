/**
 * Canonical registry of demo travelers used across the community demo UI.
 *
 * Every hardcoded person shown in the community screens (home feed, travel
 * circles, trips, events, crew chat, followers/following, join requests, etc.)
 * is mapped here to their REAL `customer_id` — the primary key of the
 * `community_profiles` master user table in planner_db.
 *
 * These UUIDs are the actual seeded rows (verified against the database), not
 * synthetic placeholders. Components use the id to navigate to
 * `/community/users/{customer_id}` so every name/avatar links back to the
 * single source of truth for user information.
 */
export interface MockTraveler {
  /** customer_id — the PK of community_profiles (and the FK on posts/trips/follows). */
  customerId: string;
  /** Display name — mirrors community_profiles.name. */
  name: string;
}

/** demo-owner / the currently signed-in demo user */
export const MOCK_OWNER: MockTraveler = {
  customerId: '1627e255-8a3c-4dbb-a553-fb797f6b0244',
  name: 'Ava Reyes',
};

export const MOCK_USERS: Record<string, MockTraveler> = {
  'Ava Reyes': { customerId: '1627e255-8a3c-4dbb-a553-fb797f6b0244', name: 'Ava Reyes' },
  'Priya Nair': { customerId: 'f9b5954f-1d7b-4e6f-bb89-1146f0807d46', name: 'Priya Nair' },
  'Maya Kondo': { customerId: '80da4269-efef-482e-bf18-b5291ce03abf', name: 'Maya Kondo' },
  'Emma Ross': { customerId: '7efdbee8-bc0a-481d-a214-08683f6869c8', name: 'Emma Ross' },
  'Aarav Menon': { customerId: '6f784546-fb73-4ce8-a982-960b50bcf76d', name: 'Aarav Menon' },
  'Daniel Rossi': { customerId: '0a96d054-53a3-4fdd-9944-ee38d61d17e2', name: 'Daniel Rossi' },
  'Rhea Sharma': { customerId: '286da2eb-d51b-4bff-b139-5724fd719cf4', name: 'Rhea Sharma' },
  'Marco Villa': { customerId: 'a2dd0a45-be25-4804-9b2c-daa81d1d358b', name: 'Marco Villa' },
  'Iker Solano': { customerId: '5ee4f1d5-9a7b-438f-86e4-e50946e2f09d', name: 'Iker Solano' },
  'Lea Fontaine': { customerId: '2a19f98e-d049-4ff4-9fb0-eb769e89bc10', name: 'Lea Fontaine' },
  'Camille Roy': { customerId: 'bd90e331-aae6-4a7b-8096-40c793876754', name: 'Camille Roy' },
  'Sofia Marchetti': { customerId: 'fd828756-f0f6-4573-956b-035b8947b4ca', name: 'Sofia Marchetti' },
  'Tom Becker': { customerId: 'a9d0815c-8c37-45a7-bea4-9e89f97a267a', name: 'Tom Becker' },
  'Jonas Weber': { customerId: '2629d17e-2f85-48d6-9777-1f5592da1601', name: 'Jonas Weber' },
  'Owen Park': { customerId: '08f2fb90-d39d-49d7-85cb-8289d11820fc', name: 'Owen Park' },
  'Liam Foster': { customerId: 'ab06d1bc-2fc8-4b4f-8d30-2a18029b26a3', name: 'Liam Foster' },
  'Sofia Almeida': { customerId: '0f5c4747-7a05-441e-b104-d40054948609', name: 'Sofia Almeida' },
  'Erik Halvorsen': { customerId: '45c59bf1-0129-401b-858f-6ee2d8aa340a', name: 'Erik Halvorsen' },
  'Nora Fjeld': { customerId: '3a64158a-f27b-4ae0-a665-0c04da0af7eb', name: 'Nora Fjeld' },
  'Yasmine Idrissi': { customerId: '1d3b1515-c835-495b-9d09-ac4b9cac8635', name: 'Yasmine Idrissi' },
  'Iker Zubia': { customerId: 'bc768cce-1bdd-4e28-8c09-0cfa68d3d403',name: 'Iker Zubia'
},
};

/** Lookup helper — returns the customer_id for a display name (falls back to owner). */
export function mockCustomerId(name: string): string {
  return MOCK_USERS[name]?.customerId ?? MOCK_OWNER.customerId;
}