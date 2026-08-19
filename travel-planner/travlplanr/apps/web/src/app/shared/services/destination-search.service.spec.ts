import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import {
  DestinationSearchService,
  normalizeSearchText,
} from './destination-search.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('DestinationSearchService', () => {
  let service: DestinationSearchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [DestinationSearchService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(DestinationSearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function seedDestinations(): void {
    service.load();
    const req = httpMock.expectOne((request) => request.url.includes('/destinations'));
    req.flush([
      { name: 'Zürich', tags: ['CITY_BREAK'], price: 50000 },
      { name: 'Goa', tags: ['BEACH', 'BUDGET'], price: 18000 },
      { name: 'Paris', tags: ['HONEYMOON'], price: 70000 },
      { name: 'Thailand', tags: ['TRENDING'], price: 22000 },
    ]);
  }

  it('normalizes diacritics for matching', () => {
    expect(normalizeSearchText('Zürich')).toBe('zurich');
  });

  it('ranks prefix matches before substring matches', () => {
    seedDestinations();
    expect(service.matchNames('go', 4)).toEqual(['Goa']);
  });

  it('filters destinations with shared matching rules', () => {
    seedDestinations();
    const results = service.filter('zur', []);
    expect(results.map((item) => item.name)).toEqual(['Zürich']);
  });

  it('applies active UI filters', () => {
    seedDestinations();
    const budgetResults = service.filter('', ['budget']);
    expect(budgetResults.map((item) => item.name).sort()).toEqual(['Goa', 'Thailand']);
  });

  it('falls back to remote search when local results are sparse', async () => {
    seedDestinations();
    const promise = firstValueFrom(service.search('Reykjavik', 5));
    const remoteReq = httpMock.expectOne(
      (request) =>
        request.url.includes('/destinations') && request.url.includes('search=Reykjavik'),
    );
    remoteReq.flush([{ id: '1', name: 'Reykjavik', country: 'Iceland' }]);

    const results = await promise;
    expect(results.map((item) => item.name)).toEqual(['Reykjavik']);
    expect(service.all().some((item) => item.name === 'Reykjavik')).toBeTrue();
  });
});
