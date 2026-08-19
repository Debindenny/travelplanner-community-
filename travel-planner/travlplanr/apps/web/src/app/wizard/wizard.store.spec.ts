import { TestBed } from '@angular/core/testing';
import { WizardStore } from './wizard.store';

const STORAGE_KEY = 'travlplanr_wizard_draft';

describe('WizardStore', () => {
  let store: WizardStore;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [WizardStore] });
    store = TestBed.inject(WizardStore);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('starts on step 1 with default state when there is no saved draft', () => {
    expect(store.step()).toBe(1);
    expect(store.destinations()).toEqual([]);
    expect(store.travelStyle()).toBe('couple');
    expect(store.budget()).toBe('mid');
    expect(store.generating()).toBe(false);
  });

  it('clamps nextStep/prevStep to the 1-6 range', () => {
    for (let i = 0; i < 10; i++) store.nextStep();
    expect(store.step()).toBe(6);

    for (let i = 0; i < 10; i++) store.prevStep();
    expect(store.step()).toBe(1);
  });

  it('setStep sets an exact step', () => {
    store.setStep(4);
    expect(store.step()).toBe(4);
  });

  it('toggleInterest adds and removes an interest', () => {
    store.toggleInterest('Beach');
    expect(store.interests()).toEqual(['Beach']);
    store.toggleInterest('Beach');
    expect(store.interests()).toEqual([]);
  });

  it('toggleFoodPreference adds and removes a preference', () => {
    store.toggleFoodPreference('vegan');
    expect(store.foodPreferences()).toEqual(['vegan']);
    store.toggleFoodPreference('vegan');
    expect(store.foodPreferences()).toEqual([]);
  });

  it('setDestinations, setDepartureInfo and setDates update their fields', () => {
    store.setDestinations(['Paris', 'Rome']);
    store.setDepartureInfo('Mumbai', true, 'Delhi');
    store.setDates('2026-08-01', '2026-08-10', false, [{ city: 'Paris', nights: 4 }]);

    expect(store.destinations()).toEqual(['Paris', 'Rome']);
    expect(store.departureLocation()).toBe('Mumbai');
    expect(store.differentArrival()).toBe(true);
    expect(store.arrivalLocation()).toBe('Delhi');
    expect(store.startDate()).toBe('2026-08-01');
    expect(store.endDate()).toBe('2026-08-10');
    expect(store.cityDays()).toEqual([{ city: 'Paris', nights: 4 }]);
  });

  it('summary reflects the current trip selections', () => {
    store.setDestinations(['Goa']);
    store.setTravelers(3);
    store.setTravelStyle('family');
    store.setBudget('luxury');

    expect(store.summary()).toEqual(
      jasmine.objectContaining({
        destinations: ['Goa'],
        travelers: 3,
        travelStyle: 'family',
        budget: 'luxury',
      })
    );
  });

  it('drives the generation lifecycle', () => {
    store.startGeneration();
    expect(store.generating()).toBe(true);
    expect(store.generationProgress()).toBe(0);

    store.setGenerationProgress(50);
    expect(store.generationProgress()).toBe(50);

    store.completeGeneration('trip-123');
    expect(store.generating()).toBe(false);
    expect(store.generationProgress()).toBe(100);
    expect(store.tripId()).toBe('trip-123');
  });

  it('failGeneration stops generating without setting a trip id', () => {
    store.startGeneration();
    store.failGeneration();
    expect(store.generating()).toBe(false);
    expect(store.generationProgress()).toBe(0);
    expect(store.tripId()).toBeNull();
  });

  it('reset clears state and the persisted draft', () => {
    store.setDestinations(['Bali']);
    store.setStep(5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step: 5 }));

    store.reset();

    expect(store.step()).toBe(1);
    expect(store.destinations()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
