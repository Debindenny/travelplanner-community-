export type TravelStyle = 'solo' | 'couple' | 'family' | 'friends';
export type BudgetTier = 'budget' | 'mid' | 'luxury';
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface WizardState {
  step: WizardStep;
  destinations: string[];
  departureLocation: string;
  differentArrival: boolean;
  arrivalLocation: string;
  startDate: string;
  endDate: string;
  aiDates: boolean;
  cityDays: { city: string; nights: number }[];
  travelers: number;
  travelStyle: TravelStyle;
  travelMethod: 'rental_car' | 'cab_taxi' | null;
  budget: BudgetTier;
  interests: string[];
  foodPreferences: string[];
  generating: boolean;
  generationProgress: number;
  tripId: string | null;
}

export const initialWizardState: WizardState = {
  step: 1,
  destinations: [],
  departureLocation: '',
  differentArrival: false,
  arrivalLocation: '',
  startDate: '',
  endDate: '',
  aiDates: false,
  cityDays: [],
  travelers: 2,
  travelStyle: 'couple',
  travelMethod: null,
  budget: 'mid',
  interests: [],
  foodPreferences: [],
  generating: false,
  generationProgress: 0,
  tripId: null,
};
