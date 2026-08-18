import { destinationMatchesFilters } from './destination-filter.util';
import { DestinationListItem } from './destination.util';

describe('destinationMatchesFilters', () => {
  const baseDestination = (overrides: Partial<DestinationListItem> = {}): DestinationListItem => ({
    name: 'Testville',
    tags: [],
    ...overrides,
  });

  it('returns true when no filters are active', () => {
    expect(destinationMatchesFilters(baseDestination(), [])).toBe(true);
  });

  it('matches honeymoon destinations by tag', () => {
    const destination = baseDestination({ tags: ['HONEYMOON'] });
    expect(destinationMatchesFilters(destination, ['honeymoon'])).toBe(true);
  });

  it('matches budget destinations by price', () => {
    const destination = baseDestination({ price: 12000 });
    expect(destinationMatchesFilters(destination, ['budget'])).toBe(true);
  });

  it('matches popular destinations from the curated list', () => {
    const destination = baseDestination({ name: 'Paris' });
    expect(destinationMatchesFilters(destination, ['popular'])).toBe(true);
  });

  it('requires at least one active filter to match', () => {
    const destination = baseDestination({ name: 'Nowhere', tags: ['CITY_BREAK'] });
    expect(destinationMatchesFilters(destination, ['honeymoon', 'family'])).toBe(false);
  });
});
