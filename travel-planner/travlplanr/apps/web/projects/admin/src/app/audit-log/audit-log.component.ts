import { Component, OnInit } from '@angular/core';

import { EmptyStateComponent } from 'ui';

@Component({
    selector: 'app-audit-log',
    imports: [EmptyStateComponent],
    templateUrl: './audit-log.component.html'
})
export class AuditLogComponent implements OnInit {
  /** No audit-log API exists yet — keep the page honest instead of mock data. */
  logs: Array<{ id: number; action: string; user: string; date: string; details: string }> = [];

  ngOnInit() {}
}
