import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'customer',
        loadComponent: () =>
          import('./customer/customer.component').then((m) => m.CustomerComponent),
      },
      {
        path: 'staff',
        loadComponent: () => import('./staff/staff.component').then((m) => m.StaffComponent),
      },
      { path: 'team', redirectTo: 'staff', pathMatch: 'full' },
      {
        path: 'b2b-agents',
        loadComponent: () =>
          import('./b2b-agents/b2b-agents.component').then((m) => m.B2bAgentsComponent),
      },
      {
        path: 'cms-packages',
        loadComponent: () =>
          import('./cms-packages/cms-packages.component').then((m) => m.CmsPackagesComponent),
      },
      {
        path: 'cms-news',
        loadComponent: () =>
          import('./cms-news/cms-news.component').then((m) => m.CmsNewsComponent),
      },
      {
        path: 'promotions',
        loadComponent: () =>
          import('./promotions/promotions.component').then((m) => m.PromotionsComponent),
      },
      {
        path: 'cms-destinations',
        loadComponent: () =>
          import('./cms-destinations/cms-destinations.component').then(
            (m) => m.CmsDestinationsComponent
          ),
      },
      {
        path: 'cms/blogs',
        loadComponent: () =>
          import('./cms-blogs/cms-blogs-page.component').then((m) => m.CmsBlogsPageComponent),
      },
      {
        path: 'cms/blogs/new',
        loadComponent: () =>
          import('./cms-blogs/cms-blog-form-page.component').then(
            (m) => m.CmsBlogFormPageComponent
          ),
      },
      {
        path: 'cms/blogs/:slug/edit',
        loadComponent: () =>
          import('./cms-blogs/cms-blog-form-page.component').then(
            (m) => m.CmsBlogFormPageComponent
          ),
      },
      {
        path: 'itinerary',
        loadComponent: () =>
          import('./itinerary/itinerary.component').then((m) => m.ItineraryComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./inventory/inventory.component').then((m) => m.InventoryComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./support/support.component').then((m) => m.SupportComponent),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./reviews/reviews.component').then((m) => m.ReviewsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'audit-log',
        loadComponent: () =>
          import('./audit-log/audit-log.component').then((m) => m.AuditLogComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
