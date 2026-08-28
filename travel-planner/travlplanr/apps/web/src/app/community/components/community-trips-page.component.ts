import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommunityTripsComponent } from '../circles-trips/features/community-trips/components/community-trips-page.component';
import { ModalShellComponent } from '../circles-trips/features/community-home/components/overlays/modal-shell/modal-shell.component';
import { ComposerTypeMenuComponent } from '../circles-trips/features/community-home/components/overlays/composer-type-menu/composer-type-menu.component';
import { ComposerFormComponent } from '../circles-trips/features/community-home/components/overlays/composer-form/composer-form.component';
import { ToastComponent } from '../circles-trips/shared/components/toast/toast.component';
import { CommunityHomeSubnavComponent } from './community-home-subnav.component';

@Component({
  selector: 'app-community-trips-page',
  imports: [
    CommunityTripsComponent,
    ModalShellComponent,
    ComposerTypeMenuComponent,
    ComposerFormComponent,
    ToastComponent,
    CommunityHomeSubnavComponent,
  ],
  styleUrl: './community-trips-page.component.scss',
  template: `
    <div class="font-manrope min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <main class="flex justify-center pt-2 sm:pt-4 lg:pt-8 pb-4 sm:pb-6 lg:pb-8 px-3 sm:px-4">
        <div class="w-full max-w-[1280px] grid grid-cols-[minmax(170px,32%)_minmax(0,1fr)] lg:grid-cols-12 gap-3 sm:gap-6 items-start">
          <div class="flex flex-col h-[calc(100vh-120px)] row-span-3 lg:col-span-2 lg:row-span-2 sticky top-[92px] gap-3 sm:gap-5">
            <app-community-home-subnav (sharePost)="trips.store.openComposerMenu()" />
          </div>

          <div class="lg:col-span-10">
            <app-community-trips #trips (goHome)="onGoHome()" />
          </div>
        </div>
      </main>

      @if (trips.store.modal()?.kind === 'composerMenu') {
        <app-modal-shell
          heading="Share something useful"
          subtitle="Pick a post type — we only ask for what that type needs."
          backdrop="light"
          (close)="trips.store.closeModal()"
        >
          <app-composer-type-menu (selectType)="trips.store.selectPostType($event)" />
        </app-modal-shell>
      } @else if (trips.store.modal()?.kind === 'composerForm') {
        <app-modal-shell
          heading="Share with travelers"
          subtitle="Pick what you post and who sees it."
          backdrop="light"
          (close)="trips.store.closeModal()"
        >
          <app-composer-form />
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
