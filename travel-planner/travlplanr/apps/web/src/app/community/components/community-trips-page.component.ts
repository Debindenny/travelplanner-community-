import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommunityTripsComponent } from '../circles-trips/features/community-trips/components/community-trips-page.component';
import { ModalShellComponent } from '../circles-trips/features/community-home/components/overlays/modal-shell/modal-shell.component';
import { ComposerTypeMenuComponent } from '../circles-trips/features/community-home/components/overlays/composer-type-menu/composer-type-menu.component';
import { ToastComponent } from '../circles-trips/shared/components/toast/toast.component';

@Component({
  selector: 'app-community-trips-page',
  imports: [CommunityTripsComponent, ModalShellComponent, ComposerTypeMenuComponent, ToastComponent],
  styleUrl: './community-trips-page.component.scss',
  template: `
    <div class="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <app-community-trips #trips (goHome)="onGoHome()" />

      @if (trips.store.modal()?.kind === 'composerMenu') {
        <app-modal-shell
          heading="Share something useful"
          subtitle="Pick a post type — we only ask for what that type needs."
          (close)="trips.store.closeModal()"
        >
          <app-composer-type-menu (selectType)="trips.store.closeModal()" />
        </app-modal-shell>
      }

      <app-toast [message]="trips.store.toast()" />
    </div>
  `,
})
export class CommunityTripsPageComponent {
  private readonly router = inject(Router);

  onGoHome(): void {
    this.router.navigate(['/community']);
  }
}
