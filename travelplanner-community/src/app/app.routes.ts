import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/community-home/routes/community-home.routes').then((m) => m.COMMUNITY_HOME_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
