import { Injectable } from '@angular/core';

/** Carried from the Trips "Plan your version" modal into the Host wizard
 * (see CommunityTripsComponent.onBuildVersion / CommunityHostEventComponent
 * constructor) so cloning a community trip feeds straight into the wizard. */
export interface HostWizardPrefill {
  route?: string[];
  startLocation?: string;
  startDate?: string;
  endDate?: string;
  maxTravelers?: number;
  journeyName?: string;
  cloneTripId?: string;
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
