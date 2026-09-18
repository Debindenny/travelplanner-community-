/**
 * Splits a hosted event's total budget across Accommodation / Transport /
 * Food / Activities based on the itinerary's real composition (nights,
 * meals, transport segments/mode, activity count), instead of hardcoded
 * per-item literals or a flat totalBudget/dayCount split.
 *
 * Used by EventHostAssistantService.buildItineraryDays() to price each
 * JourneyActivity as it's created — the allocation is decided ONCE, up
 * front, then stamped onto each item (with a costCategory tag) so
 * buildEventCostBreakdown() only ever needs to aggregate, never infer.
 */

export type CostCategory = 'accommodation' | 'activities' | 'food' | 'transport';
export type EventCostAllocation = Record<CostCategory, number>;

export interface ItineraryComposition {
  nights: number;
  mealCount: number;
  activityCount: number;
  /** Arrival + departure — always exactly 2, the trip's real transit legs. */
  mainTransportLegs: number;
  /** Airport-to-hotel shuttles — 2 when flying (arrival+departure), 0
   * otherwise. Weighted far below a main leg: a shuttle is a short local
   * transfer, not a second flight, and must not inflate Transport's share
   * just because flying happens to add more "segments". */
  shuttleLegs: number;
  transportMode: 'Flight' | 'Train' | 'Bus' | null;
}

/** Reads the itinerary's real shape from the day count + activity pool size
 * — computed BEFORE any item is priced, so the allocation can be decided
 * once and stamped onto each item as it's built, rather than reverse-
 * engineered from already-priced items afterward. Scales automatically for
 * any duration/route: nights/meals/activities all derive from `dayCount`,
 * so a longer trip or a multi-city route (more days, more legs) naturally
 * produces a bigger composition without any special-casing here. */
export function analyzeItineraryComposition(
  dayCount: number,
  activitiesPoolLength: number,
  transportMode: 'Flight' | 'Train' | 'Bus' | null,
): ItineraryComposition {
  const activityDayCount = dayCount > 1 ? dayCount - 1 : 1;
  const pool = Math.max(activitiesPoolLength, 1);
  // buildItineraryDays() pairs exactly one "Buffet Dinner" with every
  // "Planned Activity" item it creates — one activity per activity-day once
  // the pool covers every day, or the whole pool spread across the
  // activity-days when the pool is richer than the day count. Either way,
  // total activities === total meals === whichever of the two is larger.
  const activityCount = Math.max(activityDayCount, pool);

  return {
    nights: Math.max(dayCount - 1, 1),
    mealCount: activityCount,
    activityCount,
    mainTransportLegs: 2,
    shuttleLegs: transportMode === 'Flight' ? 2 : 0,
    transportMode,
  };
}

/** Relative per-unit weights — NOT rupee prices themselves, only their
 * proportions to each other. Tuned so a typical multi-night trip lands
 * accommodation-heavy (the realistic shape of a travel budget) rather than
 * letting transport dominate just because a flight happens to add two cheap
 * airport shuttles alongside its two real legs. */
const BASE_WEIGHT = {
  accommodationPerNight: 5,
  mainTransportLeg: 6,
  shuttleLeg: 1,
  foodPerMeal: 2,
  activityPerActivity: 3,
} as const;

const TRANSPORT_MODE_MULTIPLIER: Record<string, number> = { Flight: 1.5, Train: 1.0, Bus: 0.7 };

/** "3-star"/"5-star"/"budget"/"luxury" style hints scale accommodation's
 * relative weight — a host who says "5-star resort" gets a bigger
 * accommodation share than one who says "hostel", for the same night count. */
export function accommodationTierMultiplier(accommodationText: string): number {
  const t = accommodationText.toLowerCase();
  if (/\b5[\s-]?star|luxury|resort\b/.test(t)) return 1.6;
  if (/\b4[\s-]?star\b/.test(t)) return 1.3;
  if (/\bbudget|hostel|guesthouse\b/.test(t)) return 0.6;
  return 1.0; // 3-star / unspecified
}

/** The transport category's two weighted parts (main legs, shuttles) —
 * exposed separately from computeCategoryWeights() so perUnitRates() can
 * split the resolved transport TOTAL back across legs vs. shuttles using
 * the exact same proportions it was built from. */
function transportWeightParts(c: ItineraryComposition): { mainLegs: number; shuttles: number } {
  const modeMultiplier = TRANSPORT_MODE_MULTIPLIER[c.transportMode ?? ''] ?? 1.0;
  return {
    mainLegs: c.mainTransportLegs * BASE_WEIGHT.mainTransportLeg * modeMultiplier,
    shuttles: c.shuttleLegs * BASE_WEIGHT.shuttleLeg,
  };
}

function computeCategoryWeights(c: ItineraryComposition, accommodationText: string): EventCostAllocation {
  const transportParts = transportWeightParts(c);
  return {
    accommodation: c.nights * BASE_WEIGHT.accommodationPerNight * accommodationTierMultiplier(accommodationText),
    transport: transportParts.mainLegs + transportParts.shuttles,
    food: c.mealCount * BASE_WEIGHT.foodPerMeal,
    activities: c.activityCount * BASE_WEIGHT.activityPerActivity,
  };
}

/** Splits `total` across `weights` so the parts sum to EXACTLY `total` —
 * largest-remainder (Hare-Niemeyer) apportionment: floor every share, then
 * hand the leftover integer units to the categories with the largest
 * fractional remainder. Deterministic and auditable — no category is
 * systematically favored by rounding. */
export function allocateExact<K extends string>(total: number, weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const totalWeight = keys.reduce((s, k) => s + weights[k], 0);
  if (totalWeight <= 0 || total <= 0) {
    return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  }

  const shares = keys.map((k) => {
    const exact = (total * weights[k]) / totalWeight;
    return { key: k, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let remaining = total - shares.reduce((s, x) => s + x.value, 0);
  shares.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; remaining > 0; i = (i + 1) % shares.length, remaining--) {
    shares[i].value += 1;
  }

  return Object.fromEntries(shares.map((s) => [s.key, s.value])) as Record<K, number>;
}

/** Below this floor, a category that's actually present in the itinerary
 * (real nights, real transport legs, real meals, real activities) would
 * show as a suspicious/misleading ₹0 or near-₹0 in the Cost Breakdown next
 * to a real hotel/flight/activity card. Reserved PER remaining (non-
 * explicit) category before explicit overrides are allowed to draw from the
 * budget — see the scaling step below. */
const MIN_CATEGORY_SHARE = 0.05;

/** Resolves the final per-category budget for the whole event: an explicit
 * host override wins for that category, independent of the others; whatever
 * remains of the total budget after subtracting any explicit values is
 * split across the remaining categories by itinerary-composition weight.
 * Guaranteed: accommodation + transport + food + activities === totalBudget
 * (when the explicit values, after the floor-preserving scale-down below,
 * don't exceed it on their own — see the ALL-four-explicit note below).
 *
 * Confirmed failure mode this guards against: three explicit overrides
 * (e.g. transportCost + foodCost + activityCost, whether host-provided or a
 * hallucinated LLM slot value) summing to >= totalBudget left
 * remainingBudget at exactly 0, so the one category depending on it
 * (accommodation) rendered as a bare "₹0" next to a real, priced hotel
 * card — technically consistent with "explicit values win," but misleading
 * for a category the itinerary clearly needs money for. Explicit values are
 * now scaled down (proportionally to each other, so their own ratio is
 * preserved) just enough to leave every remaining category its floor. */
export function resolveCostAllocation(
  totalBudget: number,
  explicitOverrides: Partial<EventCostAllocation>,
  accommodationText: string,
  composition: ItineraryComposition,
): EventCostAllocation {
  const allCategories: CostCategory[] = ['accommodation', 'transport', 'food', 'activities'];
  const explicitKeys = (Object.keys(explicitOverrides) as CostCategory[]).filter(
    (k) => explicitOverrides[k] != null,
  );
  const remainingCategories = allCategories.filter((c) => !explicitKeys.includes(c));

  const explicitSum = explicitKeys.reduce((s, k) => s + (explicitOverrides[k] ?? 0), 0);
  // Only reserve a floor for categories that AREN'T explicit — a category
  // the host explicitly priced (even at a small amount) is a deliberate
  // choice, not a starvation bug, and isn't touched by this reservation.
  const reserved = remainingCategories.length * totalBudget * MIN_CATEGORY_SHARE;
  const explicitCeiling = Math.max(0, totalBudget - reserved);
  // Scale every explicit value down by the same factor if, together, they'd
  // eat into the reserved floor — preserves their ratio to each other
  // exactly, so a host who explicitly split 2:1 between two categories
  // still sees that same 2:1 split, just at a smaller absolute size.
  const scale = explicitSum > explicitCeiling && explicitSum > 0 ? explicitCeiling / explicitSum : 1;
  const scaledExplicit: Partial<EventCostAllocation> = {};
  for (const k of explicitKeys) scaledExplicit[k] = Math.round((explicitOverrides[k] ?? 0) * scale);
  const scaledExplicitSum = explicitKeys.reduce((s, k) => s + (scaledExplicit[k] ?? 0), 0);

  const remainingBudget = Math.max(0, totalBudget - scaledExplicitSum);
  const weights = computeCategoryWeights(composition, accommodationText);
  const remainingWeights = Object.fromEntries(
    remainingCategories.map((c) => [c, weights[c]]),
  ) as EventCostAllocation;
  const derived = allocateExact(remainingBudget, remainingWeights);

  const result = {} as EventCostAllocation;
  for (const c of allCategories) {
    result[c] = scaledExplicit[c] ?? derived[c] ?? 0;
  }
  return result;
}

/** Per-unit rates derived from the resolved totals — fed into each
 * JourneyActivity as it's built, never as standalone literals. The
 * transport category's total is split back across main legs vs. shuttles
 * using the SAME weight ratio computeCategoryWeights() used to earn that
 * total in the first place, via allocateExact() so the two parts still sum
 * to exactly `allocation.transport`. */
export function perUnitRates(allocation: EventCostAllocation, composition: ItineraryComposition) {
  const perMeal = composition.mealCount ? Math.round(allocation.food / composition.mealCount) : 0;
  const perActivity = composition.activityCount
    ? Math.round(allocation.activities / composition.activityCount)
    : 0;

  const transportParts = transportWeightParts(composition);
  const transportSplit = allocateExact(allocation.transport, {
    mainLegs: transportParts.mainLegs,
    shuttles: transportParts.shuttles,
  });
  const perMainLeg = composition.mainTransportLegs
    ? Math.round(transportSplit.mainLegs / composition.mainTransportLegs)
    : 0;
  const perShuttle = composition.shuttleLegs ? Math.round(transportSplit.shuttles / composition.shuttleLegs) : 0;

  return { perMeal, perActivity, perMainLeg, perShuttle, accommodationTotal: allocation.accommodation };
}
