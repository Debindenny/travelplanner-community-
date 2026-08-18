/**
 * Runnable test suite for chat, My Trips, and package-filter features.
 * Run: npm run test:features
 */
import {
  buildClientActions,
  extractDestinationFromMessage,
  extractDurationDays,
  extractDayNumber,
  inferIntentFromMessage,
  parseItineraryEdits,
  extractActivityAddCount,
  isGenericActivityTitle,
  suggestedActionLabel,
  ChatAction,
} from '../src/app/shared/utils/chat-intent.util';
import { parsePackageDurationDays } from '../src/app/shared/utils/package-duration.util';
import { isListedInMyTrips, MyTripsListable } from '../src/app/trip/trip-listing.util';
import { filterTripsForTab } from '../src/app/trip/my-trips-filter.util';

type Case = { name: string; run: () => void };

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

function trip(overrides: Partial<MyTripsListable> & Pick<MyTripsListable, 'id'>): MyTripsListable {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Test Trip',
    destination: overrides.destination ?? 'Dubai',
    startDate: overrides.startDate ?? '2030-06-01',
    endDate: overrides.endDate ?? '2030-06-05',
    status: overrides.status ?? 'ready',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    customizations: overrides.customizations,
  };
}

const cases: Case[] = [
  // ── Destination extraction ─────────────────────────────────────────────
  {
    name: 'extractDestination: Dubai',
    run: () => assertEqual(extractDestinationFromMessage('show Dubai packages'), 'Dubai', 'dest'),
  },
  {
    name: 'extractDestination: UAE maps to Dubai',
    run: () => assertEqual(extractDestinationFromMessage('visit UAE'), 'Dubai', 'dest'),
  },
  {
    name: 'extractDestination: unknown returns null',
    run: () => assertEqual(extractDestinationFromMessage('hello'), null, 'dest'),
  },

  // ── Duration / day ───────────────────────────────────────────────────
  {
    name: 'extractDurationDays: 4 days',
    run: () => assertEqual(extractDurationDays('make a 4 days trip'), 4, 'days'),
  },
  {
    name: 'extractDayNumber: day 2',
    run: () => assertEqual(extractDayNumber('add snorkeling on day 2'), 2, 'day'),
  },

  // ── Intent classification ────────────────────────────────────────────
  {
    name: 'intent: create_trip plan days in city without trip word',
    run: () => assertEqual(inferIntentFromMessage('Plan 5 days in Ljubljana'), 'create_trip', 'intent'),
  },
  {
    name: 'intent: create_trip plan days in Paris',
    run: () => assertEqual(inferIntentFromMessage('plan 4 days in Paris'), 'create_trip', 'intent'),
  },
  {
    name: 'intent: filter_packages not create_trip',
    run: () => assertEqual(inferIntentFromMessage('filter 4 days packages'), 'filter_packages', 'intent'),
  },
  {
    name: 'intent: browse_packages',
    run: () => assertEqual(inferIntentFromMessage('show dubai packages'), 'browse_packages', 'intent'),
  },
  {
    name: 'intent: fix_itinerary',
    run: () => assertEqual(inferIntentFromMessage('fix my itinerary'), 'fix_itinerary', 'intent'),
  },
  {
    name: 'intent: modify_itinerary add activity',
    run: () => assertEqual(inferIntentFromMessage('add snorkeling on day 2'), 'modify_itinerary', 'intent'),
  },
  {
    name: 'intent: modify_itinerary remove',
    run: () =>
      assertEqual(inferIntentFromMessage('remove food tasting from day 3'), 'modify_itinerary', 'intent'),
  },
  {
    name: 'intent: modify_itinerary add transport',
    run: () => assertEqual(inferIntentFromMessage('add a train on day 2'), 'modify_itinerary', 'intent'),
  },
  {
    name: 'intent: compare_prices',
    run: () => assertEqual(inferIntentFromMessage('find me the cheapest 5-day Bali package'), 'compare_prices', 'intent'),
  },
  {
    name: 'intent: multi_city_trip',
    run: () => assertEqual(inferIntentFromMessage('Paris → Rome → Barcelona in 10 days'), 'multi_city_trip', 'intent'),
  },
  {
    name: 'intent: book_package',
    run: () => assertEqual(inferIntentFromMessage('book the Standard Bali package'), 'book_package', 'intent'),
  },
  {
    name: 'intent: regenerate_day',
    run: () => assertEqual(inferIntentFromMessage('make day 3 more relaxing'), 'regenerate_day', 'intent'),
  },
  {
    name: 'intent: save_note',
    run: () => assertEqual(inferIntentFromMessage('remind me I want a sunset dinner on day 4'), 'save_note', 'intent'),
  },
  {
    name: 'intent: group_trip',
    run: () => assertEqual(inferIntentFromMessage('we are 4 people planning a trip to Dubai'), 'group_trip', 'intent'),
  },
  {
    name: 'intent: weather_query',
    run: () => assertEqual(inferIntentFromMessage('what is the weather in Bali'), 'weather_query', 'intent'),
  },
  {
    name: 'intent: budget_filter',
    run: () => assertEqual(inferIntentFromMessage('plan a $2000 week in Thailand'), 'budget_filter', 'intent'),
  },
  {
    name: 'intent: show_images',
    run: () => assertEqual(inferIntentFromMessage('show me beaches in Maldives'), 'show_images', 'intent'),
  },
  {
    name: 'intent: show_itinerary follow-up chip',
    run: () =>
      assertEqual(
        inferIntentFromMessage('Turn this into a full itinerary'),
        'show_itinerary',
        'intent',
      ),
  },

  // ── Itinerary edits ──────────────────────────────────────────────────
  {
    name: 'parseItineraryEdits: add 4 more activities to day 3',
    run: () => {
      const edits = parseItineraryEdits('can you add 4 more activities to day 3');
      assertEqual(edits.length, 1, 'single bulk edit');
      assertEqual(edits[0].edit, 'add_activity', 'edit kind');
      assertEqual(edits[0].day, 3, 'day');
      assertEqual(edits[0].count, 4, 'count');
      assertEqual(edits[0].autoSuggest, true, 'autoSuggest');
    },
  },
  {
    name: 'extractActivityAddCount: four activities',
    run: () => assertEqual(extractActivityAddCount('add 4 more activities to day 3'), 4, 'count'),
  },
  {
    name: 'isGenericActivityTitle: rejects literal title',
    run: () => assertEqual(isGenericActivityTitle('4 More Activities'), true, 'generic'),
  },
  {
    name: 'parseItineraryEdits: add activity',
    run: () => {
      const edits = parseItineraryEdits('add snorkeling on day 2');
      assertEqual(edits[0].edit, 'add_activity', 'edit kind');
      assertEqual(edits[0].title, 'Snorkeling', 'title');
      assertEqual(edits[0].day, 2, 'day');
    },
  },
  {
    name: 'parseItineraryEdits: add train',
    run: () => {
      const edits = parseItineraryEdits('add a train on day 2');
      assertEqual(edits[0], { edit: 'add_transport', transportType: 'train', day: 2 }, 'train edit');
    },
  },
  {
    name: 'parseItineraryEdits: swap camry to bus (user prompt)',
    run: () => {
      const edits = parseItineraryEdits('the toyota camry car change it to any bus available');
      assertEqual(edits[0].edit, 'swap_transport', 'edit');
      assertEqual(edits[0].fromTitleMatch, 'toyota camry', 'from');
      assertEqual(edits[0].toType, 'bus', 'to');
      assertEqual(edits[0].day, 1, 'day');
    },
  },
  {
    name: 'parseItineraryEdits: change day 1 car to bus',
    run: () => {
      const edits = parseItineraryEdits('change day 1 car to a bus');
      assertEqual(edits[0].edit, 'swap_transport', 'edit');
      assertEqual(edits[0].fromType, 'car', 'fromType');
      assertEqual(edits[0].toType, 'bus', 'to');
      assertEqual(edits[0].day, 1, 'day');
      assertEqual(edits[0].fromTitleMatch, undefined, 'no bogus title match');
    },
  },
  {
    name: 'parseItineraryEdits: change car to bus',
    run: () => {
      const edits = parseItineraryEdits('change the car to a bus');
      assertEqual(edits[0].edit, 'swap_transport', 'edit');
      assertEqual(edits[0].toType, 'bus', 'to');
    },
  },
  {
    name: 'buildClientActions: swap_transport',
    run: () => {
      const actions = buildClientActions('change toyota camry to bus', 'trip-1');
      assertEqual(actions[0].type, 'itinerary_edit', 'type');
      assertEqual(actions[0].edit, 'swap_transport', 'edit');
      assertEqual(actions[0].toType, 'bus', 'to');
    },
  },
  {
    name: 'parseItineraryEdits: remove activity',
    run: () => {
      const edits = parseItineraryEdits('remove food tasting from day 3');
      assert(edits[0].edit === 'remove_item', 'remove');
      assert(edits[0].titleMatch === 'food tasting', 'match');
      assert(edits[0].day === 3, 'day');
    },
  },

  // ── Client actions ───────────────────────────────────────────────────
  {
    name: 'buildClientActions: create_trip includes coverageTier full',
    run: () => {
      const actions = buildClientActions('make a 4 day trip to Dubai');
      const create = actions.find((a) => a.type === 'create_trip')!;
      assertEqual(create.coverageTier, 'full', 'coverageTier');
    },
  },
  {
    name: 'buildClientActions: no create_trip for unrecognized place without destination',
    run: () => {
      const actions = buildClientActions('Plan 5 days in Ljubljana');
      assert(!actions.some((a) => a.type === 'create_trip'), 'no auto create');
    },
  },
  {
    name: 'buildClientActions: no create_trip for vague somewhere warm',
    run: () => {
      const actions = buildClientActions('somewhere warm for 5 days');
      assert(!actions.some((a) => a.type === 'create_trip'), 'no trip');
    },
  },
  {
    name: 'buildClientActions: group_trip sets coverageTier full',
    run: () => {
      const actions = buildClientActions('we are 4 people planning a trip to Dubai');
      const create = actions.find((a) => a.type === 'create_trip')!;
      assertEqual(create.coverageTier, 'full', 'coverage');
      assertEqual(create.travelStyle, 'friends', 'style');
    },
  },
  {
    name: 'suggestedActionLabel: create_draft_trip',
    run: () => {
      const label = suggestedActionLabel({ type: 'create_draft_trip', destination: 'Ljubljana' } as ChatAction);
      assert(label.includes('Ljubljana'), 'destination in label');
      assert(label.toLowerCase().includes('draft'), 'draft in label');
    },
  },
  {
    name: 'suggestedActionLabel: show_similar_destinations',
    run: () => {
      const label = suggestedActionLabel({
        type: 'show_similar_destinations',
        similar: ['Italy', 'Austria', 'Greece'],
      } as ChatAction);
      assert(label.includes('Italy'), 'similar in label');
    },
  },
  {
    name: 'suggestedActionLabel: request_destination',
    run: () => {
      const label = suggestedActionLabel({ type: 'request_destination', destination: 'Ljubljana' } as ChatAction);
      assert(label.includes('Request'), 'request prefix');
      assert(label.includes('Ljubljana'), 'place name');
    },
  },
  {
    name: 'buildClientActions: filter_packages',
    run: () => {
      const actions = buildClientActions('filter 4 days packages', null, 'Europe');
      assert(actions.some((a) => a.type === 'filter_packages' && a.durationDays === 4), 'filter');
      assert(actions.some((a) => a.type === 'navigate_packages'), 'navigate');
    },
  },
  {
    name: 'buildClientActions: itinerary_edit with tripId',
    run: () => {
      const actions = buildClientActions('add snorkeling on day 2', 'trip-1');
      assertEqual(actions[0].type, 'itinerary_edit', 'type');
      assertEqual(actions[0].tripId, 'trip-1', 'tripId');
    },
  },
  {
    name: 'buildClientActions: rebuild_itinerary',
    run: () => {
      const actions = buildClientActions('fix my itinerary', 'trip-99');
      assertEqual(actions[0], { type: 'rebuild_itinerary', tripId: 'trip-99' }, 'rebuild');
    },
  },
  {
    name: 'buildClientActions: create_trip uses region fallback',
    run: () => {
      const actions = buildClientActions('plan a 3 day trip', null, 'Singapore');
      const create = actions.find((a) => a.type === 'create_trip')!;
      assertEqual(create.destination, 'Singapore', 'region fallback');
    },
  },

  // ── My Trips listing (save/book only) ────────────────────────────────
  {
    name: 'isListedInMyTrips: draft ready trip hidden',
    run: () => assertEqual(isListedInMyTrips(trip({ id: '1', status: 'ready' })), false, 'draft'),
  },
  {
    name: 'isListedInMyTrips: saved trip visible',
    run: () =>
      assertEqual(
        isListedInMyTrips(trip({ id: '2', customizations: { savedToMyTrips: true } })),
        true,
        'saved',
      ),
  },
  {
    name: 'isListedInMyTrips: booked trip visible',
    run: () => assertEqual(isListedInMyTrips(trip({ id: '3', status: 'booked' })), true, 'booked'),
  },
  {
    name: 'isListedInMyTrips: pending trip visible',
    run: () => assertEqual(isListedInMyTrips(trip({ id: '4', status: 'pending' })), true, 'pending'),
  },
  {
    name: 'isListedInMyTrips: generating trip hidden',
    run: () => assertEqual(isListedInMyTrips(trip({ id: '5', status: 'generating' })), false, 'gen'),
  },

  // ── Tab filtering ────────────────────────────────────────────────────
  {
    name: 'filterTripsForTab: upcoming excludes unsaved drafts',
    run: () => {
      const trips = [
        trip({ id: 'draft', status: 'ready', startDate: '2030-01-01' }),
        trip({ id: 'saved', customizations: { savedToMyTrips: true }, startDate: '2030-01-01' }),
      ];
      const upcoming = filterTripsForTab(trips, 'upcoming', new Date('2026-01-01'));
      assertEqual(upcoming.map((t) => t.id), ['saved'], 'upcoming');
    },
  },
  {
    name: 'filterTripsForTab: upcoming excludes past saved trips',
    run: () => {
      const trips = [
        trip({
          id: 'past',
          customizations: { savedToMyTrips: true },
          startDate: '2020-01-01',
          endDate: '2020-01-05',
        }),
        trip({
          id: 'future',
          customizations: { savedToMyTrips: true },
          startDate: '2030-01-01',
          endDate: '2030-01-05',
        }),
      ];
      const upcoming = filterTripsForTab(trips, 'upcoming', new Date('2026-06-01'));
      assertEqual(upcoming.map((t) => t.id), ['future'], 'upcoming future only');
    },
  },
  {
    name: 'filterTripsForTab: recent shows ended saved trips',
    run: () => {
      const trips = [
        trip({
          id: 'past',
          customizations: { savedToMyTrips: true },
          startDate: '2020-01-01',
          endDate: '2020-01-05',
        }),
        trip({
          id: 'future',
          customizations: { savedToMyTrips: true },
          startDate: '2030-01-01',
          endDate: '2030-01-05',
        }),
      ];
      const recent = filterTripsForTab(trips, 'recent', new Date('2026-06-01'));
      assertEqual(recent.map((t) => t.id), ['past'], 'recent');
    },
  },
  {
    name: 'filterTripsForTab: saved tab includes all listed trips',
    run: () => {
      const trips = [
        trip({ id: 'draft', status: 'ready' }),
        trip({ id: 'saved', customizations: { savedToMyTrips: true } }),
        trip({ id: 'booked', status: 'booked' }),
      ];
      const saved = filterTripsForTab(trips, 'saved', new Date('2026-06-01'));
      assert(saved.length === 2, 'saved count');
      assert(saved.some((t) => t.id === 'saved'), 'has saved');
      assert(saved.some((t) => t.id === 'booked'), 'has booked');
    },
  },

  // ── Package duration parsing ───────────────────────────────────────────
  {
    name: 'parsePackageDurationDays: standard string',
    run: () => assertEqual(parsePackageDurationDays('7 Days : 6 Night / 5Days'), 7, 'max days'),
  },
  {
    name: 'parsePackageDurationDays: simple',
    run: () => assertEqual(parsePackageDurationDays('4 Days'), 4, 'simple'),
  },
  {
    name: 'parsePackageDurationDays: invalid',
    run: () => assertEqual(parsePackageDurationDays('no duration'), null, 'null'),
  },
];

console.log(`\nRunning ${cases.length} feature test cases...\n`);

for (const c of cases) {
  try {
    c.run();
    passed++;
    console.log(`  ✓ ${c.name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${c.name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed (${cases.length} total)\n`);

if (failed > 0) {
  process.exit(1);
}
