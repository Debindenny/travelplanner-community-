import { Injectable } from '@angular/core';

/** Carried from the Trips "Plan your version" modal into the Host wizard
 * (see CommunityTripsComponent.onBuildVersion / CommunityHostEventComponent
 * constructor) so cloning a community trip feeds straight into the wizard. */
export interface HostWizardPrefill {
  route?: string[];
  startLocation?: string;
  startDate?: string;
  endDate?: string;
  /** Length (in days) of the cloned trip's own route — used to keep the
   * wizard's end date locked to `startDate + (days - 1)` since a cloned
   * itinerary's length isn't independently editable. */
  days?: number;
  maxTravelers?: number;
  journeyName?: string;
  cloneTripId?: string;
  /** The cloned trip's own hero image, used for the published event card
   * instead of a generic default so it actually shows the destination. */
  image?: string;
}

/**
 * Plain in-memory handoff for the host wizard prefill, set right before
 * navigating to it and read once in its constructor. Router navigation
 * `state` is unreliable here because the target is a `loadComponent` route:
 * the dynamic import resolves asynchronously, and by the time the component
 * is actually constructed `Router.getCurrentNavigation()` can already be
 * null — this service sidesteps that entirely.
 */
@Injectable({ providedIn: 'root' })
export class HostWizardPrefillService {
  private pending: HostWizardPrefill | null = null;

  set(prefill: HostWizardPrefill): void {
    this.pending = prefill;
  }

  /** Read-once: returns the pending prefill (if any) and clears it. */
  consume(): HostWizardPrefill | null {
    const value = this.pending;
    this.pending = null;
    return value;
  }
}
