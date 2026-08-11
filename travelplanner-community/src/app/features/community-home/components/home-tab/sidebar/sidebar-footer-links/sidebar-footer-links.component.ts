import { ChangeDetectionStrategy, Component } from '@angular/core';

import { FOOTER_LINKS } from '../../../../../../core/data/community-mock-data';

@Component({
  selector: 'app-sidebar-footer-links',
  imports: [],
  templateUrl: './sidebar-footer-links.component.html',
  styleUrl: './sidebar-footer-links.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarFooterLinksComponent {
  readonly links = FOOTER_LINKS;
}
