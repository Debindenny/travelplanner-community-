import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommunityTravelCirclesComponent } from '../circles-trips/features/community-travelcircles/components/community-travelcircles-page.component';
import { ToastComponent } from '../circles-trips/shared/components/toast/toast.component';

@Component({
  selector: 'app-community-travel-circles-page',
  imports: [CommunityTravelCirclesComponent, ToastComponent],
  styleUrl: './community-travel-circles-page.component.scss',
  template: `
    <div class="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <app-community-travelcircles #circles (goHome)="onGoHome()" />
      <app-toast [message]="circles.store.toast()" />
    </div>
  `,
})
export class CommunityTravelCirclesPageComponent {
  private readonly router = inject(Router);

  onGoHome(): void {
    this.router.navigate(['/community']);
  }
}
