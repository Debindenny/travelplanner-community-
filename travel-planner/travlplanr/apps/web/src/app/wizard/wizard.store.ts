import { Injectable, computed, effect, signal } from '@angular/core';
import { BudgetTier, TravelStyle, WizardState, WizardStep, initialWizardState } from './store/wizard.models';

const STORAGE_KEY = 'travlplanr_wizard_draft';

function loadInitialState(): WizardState {
  if (typeof localStorage === 'undefined') {
    return initialWizardState;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Don't restore 'generating' state stuck on true from an interrupted session.
      return { ...initialWizardState, ...parsed, generating: false, generationProgress: 0 };
    }
  } catch (e) {
    console.error('Failed to parse wizard draft', e);
  }
  return initialWizardState;
}

@Injectable({ providedIn: 'root' })
export class WizardStore {
  private readonly initial = loadInitialState();

  readonly step = signal<WizardStep>(this.initial.step);
  readonly destinations = signal<string[]>(this.initial.destinations);
  readonly departureLocation = signal<string>(this.initial.departureLocation);
  readonly differentArrival = signal<boolean>(this.initial.differentArrival);
  readonly arrivalLocation = signal<string>(this.initial.arrivalLocation);
  readonly startDate = signal<string>(this.initial.startDate);
  readonly endDate = signal<string>(this.initial.endDate);
  readonly aiDates = signal<boolean>(this.initial.aiDates);
  readonly cityDays = signal<{ city: string; nights: number }[]>(this.initial.cityDays);
  readonly travelers = signal<number>(this.initial.travelers);
  readonly travelStyle = signal<TravelStyle>(this.initial.travelStyle);
  readonly travelMethod = signal<'rental_car' | 'cab_taxi' | null>(this.initial.travelMethod);
  readonly budget = signal<BudgetTier>(this.initial.budget);
  readonly interests = signal<string[]>(this.initial.interests);
  readonly foodPreferences = signal<string[]>(this.initial.foodPreferences);
  readonly generating = signal<boolean>(this.initial.generating);
  readonly generationProgress = signal<number>(this.initial.generationProgress);
  readonly tripId = signal<string | null>(this.initial.tripId);

  readonly summary = computed(() => ({
    destinations: this.destinations(),
    startDate: this.startDate(),
    endDate: this.endDate(),
    travelers: this.travelers(),
    travelStyle: this.travelStyle(),
    travelMethod: this.travelMethod(),
    budget: this.budget(),
    interests: this.interests(),
    foodPreferences: this.foodPreferences(),
  }));

  constructor() {
    // Mirrors the old NgRx reducer's on-every-action localStorage sync: any
    // signal write here re-runs this effect and persists the full snapshot.
    effect(() => {
      const snapshot: WizardState = {
        step: this.step(),
        destinations: this.destinations(),
        departureLocation: this.departureLocation(),
        differentArrival: this.differentArrival(),
        arrivalLocation: this.arrivalLocation(),
        startDate: this.startDate(),
        endDate: this.endDate(),
        aiDates: this.aiDates(),
        cityDays: this.cityDays(),
        travelers: this.travelers(),
        travelStyle: this.travelStyle(),
        travelMethod: this.travelMethod(),
        budget: this.budget(),
        interests: this.interests(),
        foodPreferences: this.foodPreferences(),
        generating: this.generating(),
        generationProgress: this.generationProgress(),
        tripId: this.tripId(),
      };
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch (e) {
        console.error('Failed to save wizard draft', e);
      }
    });
  }

  setStep(step: WizardStep): void {
    this.step.set(step);
  }

  nextStep(): void {
    this.step.update((s) => Math.min(6, s + 1) as WizardStep);
  }

  prevStep(): void {
    this.step.update((s) => Math.max(1, s - 1) as WizardStep);
  }

  setDestinations(destinations: string[]): void {
    this.destinations.set(destinations);
  }

  setDepartureInfo(departureLocation: string, differentArrival: boolean, arrivalLocation: string): void {
    this.departureLocation.set(departureLocation);
    this.differentArrival.set(differentArrival);
    this.arrivalLocation.set(arrivalLocation);
  }

  setDates(startDate: string, endDate: string, aiDates: boolean, cityDays: { city: string; nights: number }[]): void {
    this.startDate.set(startDate);
    this.endDate.set(endDate);
    this.aiDates.set(aiDates);
    this.cityDays.set(cityDays);
  }

  setTravelers(travelers: number): void {
    this.travelers.set(travelers);
  }

  setTravelStyle(travelStyle: TravelStyle): void {
    this.travelStyle.set(travelStyle);
  }

  setTravelMethod(travelMethod: 'rental_car' | 'cab_taxi'): void {
    this.travelMethod.set(travelMethod);
  }

  setBudget(budget: BudgetTier): void {
    this.budget.set(budget);
  }

  toggleInterest(interest: string): void {
    this.interests.update((interests) =>
      interests.includes(interest) ? interests.filter((i) => i !== interest) : [...interests, interest]
    );
  }

  toggleFoodPreference(foodPreference: string): void {
    this.foodPreferences.update((prefs) =>
      prefs.includes(foodPreference) ? prefs.filter((p) => p !== foodPreference) : [...prefs, foodPreference]
    );
  }

  startGeneration(): void {
    this.generating.set(true);
    this.generationProgress.set(0);
  }

  setGenerationProgress(progress: number): void {
    this.generationProgress.set(progress);
  }

  completeGeneration(tripId: string): void {
    this.generating.set(false);
    this.generationProgress.set(100);
    this.tripId.set(tripId);
  }

  failGeneration(): void {
    this.generating.set(false);
    this.generationProgress.set(0);
  }

  reset(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.step.set(initialWizardState.step);
    this.destinations.set(initialWizardState.destinations);
    this.departureLocation.set(initialWizardState.departureLocation);
    this.differentArrival.set(initialWizardState.differentArrival);
    this.arrivalLocation.set(initialWizardState.arrivalLocation);
    this.startDate.set(initialWizardState.startDate);
    this.endDate.set(initialWizardState.endDate);
    this.aiDates.set(initialWizardState.aiDates);
    this.cityDays.set(initialWizardState.cityDays);
    this.travelers.set(initialWizardState.travelers);
    this.travelStyle.set(initialWizardState.travelStyle);
    this.travelMethod.set(initialWizardState.travelMethod);
    this.budget.set(initialWizardState.budget);
    this.interests.set(initialWizardState.interests);
    this.foodPreferences.set(initialWizardState.foodPreferences);
    this.generating.set(initialWizardState.generating);
    this.generationProgress.set(initialWizardState.generationProgress);
    this.tripId.set(initialWizardState.tripId);
  }
}
