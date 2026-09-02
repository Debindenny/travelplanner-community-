import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { pendingChangesGuard } from './shared/guards/pending-changes.guard';
import { environment } from '../environments/environment';

/** Blocks the dev-only /design-system route from resolving in production builds. */
const devOnlyGuard = () => !environment.production;

export const routes: Routes = [
  {
    path: 'design-system',
    canActivate: [devOnlyGuard],
    loadComponent: () =>
      import('./design-system/design-system-page.component').then(
        (m) => m.DesignSystemPageComponent
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./landing/landing-page.component').then((m) => m.LandingPageComponent),
  },
  {
    path: 'explore',
    loadComponent: () =>
      import('./explore/explore-page.component').then((m) => m.ExplorePageComponent),
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./blog/blog-page.component').then((m) => m.BlogPageComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./blog/blog-post-page.component').then((m) => m.BlogPostPageComponent),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./terms/terms-page.component').then((m) => m.TermsPageComponent),
  },
  {
    path: 'faq',
    loadComponent: () =>
      import('./faq/faq-page.component').then((m) => m.FaqPageComponent),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./privacy/privacy-page.component').then((m) => m.PrivacyPageComponent),
  },

  {
    path: 'about',
    loadComponent: () =>
      import('./about/about-page.component').then((m) => m.AboutPageComponent),
  },
  {
    path: 'how-it-works',
    loadComponent: () =>
      import('./how-it-works/how-it-works-page.component').then((m) => m.HowItWorksPageComponent),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./contact/contact-page.component').then((m) => m.ContactPageComponent),
  },
  {
    path: 'resources',
    loadComponent: () =>
      import('./resources/resources-page.component').then((m) => m.ResourcesPageComponent),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import('./pricing/pricing-page.component').then((m) => m.PricingPageComponent),
  },
  {
    path: 'partners',
    loadComponent: () =>
      import('./partners/partners-page.component').then((m) => m.PartnersPageComponent),
  },

  {
    path: '',
    loadComponent: () =>
      import('./shared/layouts/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'trips',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./trip/trips-page.component').then((m) => m.TripsPageComponent),
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./profile/profile-page.component').then((m) => m.ProfilePageComponent),
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./auth/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'wizard',
        canActivate: [authGuard],
        canDeactivate: [pendingChangesGuard],
        loadComponent: () =>
          import('./wizard/wizard-page.component').then((m) => m.WizardPageComponent),
      },
      {
        path: 'itinerary/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./itinerary/itinerary-page.component').then((m) => m.ItineraryPageComponent),
      },
      {
        path: 'invite/:token',
        loadComponent: () =>
          import('./collaboration/invite-page.component').then((m) => m.InvitePageComponent),
      },
      {
        path: 'community/messages',
        canActivate: [authGuard],
        loadComponent: () => import('./community/community-messages-page.component').then(m => m.CommunityMessagesPageComponent)
      },
      {
        path: 'community',
        pathMatch: 'full',
        loadComponent: () =>
          import('./community/community-page.component').then((m) => m.CommunityPageComponent),
      },
      {
        path: 'community/discover',
        loadComponent: () =>
          import('./community/discover-saved/discover/discover-page.component').then((m) => m.DiscoverPageComponent),
      },
      {
        path: 'community/destinations',
        loadComponent: () =>
          import('./community/components/community-destinations-page.component').then((m) => m.CommunityDestinationsPageComponent),
      },
      {
        path: 'community/saved',
        loadComponent: () =>
          import('./community/discover-saved/saved/saved-page.component').then((m) => m.SavedPageComponent),
      },
      {
        path: 'community/collections',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./community/community-collections-page.component').then((m) => m.CommunityCollectionsPageComponent),
      },
      {
        path: 'community/collections/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./community/community-collection-detail-page.component').then((m) => m.CommunityCollectionDetailPageComponent),
      },
      {
        path: 'community/reels',
        loadComponent: () =>
          import('./community/components/community-reels.component').then((m) => m.CommunityReelsComponent),
      },
      {
        path: 'community/matching',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./community/components/matching.component').then((m) => m.MatchingComponent),
      },
      {
        path: 'community/travel-circles',
        loadComponent: () =>
          import('./community/components/community-travel-circles-page.component').then((m) => m.CommunityTravelCirclesPageComponent),
      },
      {
        path: 'community/trips',
        loadComponent: () =>
          import('./community/components/community-trips-page.component').then((m) => m.CommunityTripsPageComponent),
      },
      {
        path: 'community/users/:id',
        loadComponent: () =>
          import('./community/components/community-profile.component').then((m) => m.CommunityProfileComponent),
      },
      {
        path: 'community/posts/:id',
        loadComponent: () =>
          import('./community/components/community-post-detail.component').then((m) => m.CommunityPostDetailComponent),
      },
      {
        path: 'community/spaces',
        loadComponent: () =>
          import('./community/components/community-spaces.component').then((m) => m.CommunitySpacesComponent),
      },
      {
        path: 'community/spaces/:id',
        loadComponent: () =>
          import('./community/components/community-space-detail.component').then((m) => m.CommunitySpaceDetailComponent),
      },
      {
        path: 'community/events',
        loadComponent: () =>
          import('./community/components/community-events.component').then((m) => m.CommunityEventsComponent),
      },
      {
        path: 'community/events/host',
        loadComponent: () =>
          import('./community/components/community-host-event.component').then((m) => m.CommunityHostEventComponent),
      },
      {
        path: 'community/events/:id',
        loadComponent: () =>
          import('./community/components/community-event-view.component').then((m) => m.CommunityEventDetailViewComponent),
      },
      {
        path: 'community/journals',
        loadComponent: () =>
          import('./community/components/community-journal.component').then((m) => m.CommunityJournalComponent),
      },
      {
        path: 'community/journals/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./community/components/community-journal-editor.component').then((m) => m.CommunityJournalEditorComponent),
      },
      {
        path: 'community/journals/:id',
        loadComponent: () =>
          import('./community/components/community-journal.component').then((m) => m.CommunityJournalComponent),
      },
      {
        path: 'community/guidelines',
        loadComponent: () =>
          import('./community/components/community-guidelines.component').then((m) => m.CommunityGuidelinesComponent),
      },
      {
        path: 'community/notification-preferences',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./community/components/community-notification-preferences.component').then((m) => m.CommunityNotificationPreferencesComponent),
      },
      {
        path: 'community/achievements',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./community/components/community-achievements.component').then((m) => m.CommunityAchievementsComponent),
      },
      {
        path: 'community/leaderboard',
        loadComponent: () =>
          import('./community/components/community-leaderboard.component').then((m) => m.CommunityLeaderboardComponent),
      },
      {
        path: 'packages',
        loadComponent: () =>
          import('./packages/packages-page.component').then((m) => m.PackagesPageComponent),
      },
      {
        path: 'transfers',
        loadComponent: () =>
          import('./transfers/transfers-page.component').then((m) => m.TransfersPageComponent),
      },
      {
        path: 'packages/:id',
        loadComponent: () =>
          import('./packages/package-detail-page.component').then((m) => m.PackageDetailPageComponent),
      },
      {
        path: 'for-you',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./for-you/for-you-page.component').then((m) => m.ForYouPageComponent),
      },
      {
        path: 'checkout/success',
        loadComponent: () =>
          import('./checkout/checkout-success-page.component').then((m) => m.CheckoutSuccessPageComponent),
      },
      {
        path: 'checkout/cancel',
        loadComponent: () =>
          import('./checkout/checkout-cancel-page.component').then((m) => m.CheckoutCancelPageComponent),
      },
    ],
  },
  { path: '**', loadComponent: () => import('./not-found/not-found-page.component').then((m) => m.NotFoundPageComponent) },
];
