import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CommunityPostService, TripTemplateDetail } from '../../../../../services/community-post.service';

@Component({
  selector: 'app-trip-template-preview',
  imports: [IconComponent],
  templateUrl: './trip-template-preview.component.html',
  styleUrl: './trip-template-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripTemplatePreviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly communityPostService = inject(CommunityPostService);

  readonly trip = signal<TripTemplateDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    const tripId = this.route.snapshot.paramMap.get('id');
    if (!tripId) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.communityPostService.getTripTemplateDetail(tripId).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  goBack(): void {
    this.location.back();
  }
}
