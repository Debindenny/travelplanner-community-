import { DestinationFilter, POPULAR_DESTINATIONS_LIST } from '../data/destinations.data';
import { DestinationListItem } from './destination.util';

const FILTER_TAG_ALIASES: Record<DestinationFilter, string[]> = {
  'in-season': ['in_season', 'in-season', 'inseason', 'seasonal'],
  honeymoon: ['honeymoon', 'romantic', 'couple'],
  trending: ['trending', 'trending_europe', 'hot'],
  budget: ['budget', 'affordable', 'cheap'],
  family: ['family', 'city_break', 'kids'],
  popular: ['popular', 'iconic', 'trending'],
};

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function tagMatchesFilter(tag: string, filter: DestinationFilter): boolean {
  const normalized = normalizeTag(tag);
  return FILTER_TAG_ALIASES[filter].some(
    (alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized),
  );
}

function popularFiltersForName(name: string): DestinationFilter[] {
  const entry = POPULAR_DESTINATIONS_LIST.find(
    (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  return entry?.filters ?? [];
}

/** Whether a destination matches any of the active UI filter pills. */
export function destinationMatchesFilters(
  destination: DestinationListItem,
  activeFilters: Iterable<DestinationFilter>,
): boolean {
  const filters = [...activeFilters];
  if (!filters.length) return true;

  const popular = popularFiltersForName(destination.name);
  const tags = destination.tags ?? [];
  const price = Number(destination.price ?? 0);
  const isBudget = price > 0 && price < 25000;

  return filters.some((filter) => {
    if (filter === 'budget' && isBudget) return true;
    if (popular.includes(filter)) return true;
    return tags.some((tag) => tagMatchesFilter(tag, filter));
  });
}
