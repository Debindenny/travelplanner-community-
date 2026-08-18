import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

export interface DataTableHeader {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

@Component({
    selector: 'app-data-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, SkeletonComponent],
    template: `
    <div class="w-full overflow-x-auto rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <table class="w-full border-collapse text-sm text-left">
        <thead>
          <tr class="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/50">
            @for (h of headers; track h.key) {
              <th
                [style.width]="h.width || 'auto'"
                class="px-6 py-4 font-bold text-text-secondary dark:text-gray-400 uppercase tracking-wider text-xs select-none"
                [ngClass]="{
                  'text-center': h.align === 'center',
                  'text-right': h.align === 'right',
                  'cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors': h.sortable
                }"
                (click)="onHeaderClick(h)"
                >
                <div class="flex items-center gap-1.5" [ngClass]="{
                  'justify-center': h.align === 'center',
                  'justify-end': h.align === 'right'
                }">
                  <span>{{ h.label }}</span>
                  @if (h.sortable && sortKey === h.key) {
                    <span class="text-primary text-[10px]">
                      {{ sortDirection === 'asc' ? '▲' : '▼' }}
                    </span>
                  }
                </div>
              </th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-gray-800">
          @if (loading) {
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <tr>
                <td [attr.colspan]="headers.length" class="px-6 py-4">
                  <app-skeleton variant="table-row" />
                </td>
              </tr>
            }
          } @else if (data.length === 0) {
            <tr>
              <td [attr.colspan]="headers.length" class="px-6 py-12 text-center text-text-disabled dark:text-gray-500 font-medium">
                No records found.
              </td>
            </tr>
          } @else {
            @for (row of data; track row.id || $index) {
              <tr class="hover:bg-slate-50/50 dark:hover:bg-gray-800/30 transition-colors">
                @for (h of headers; track h.key) {
                  <td
                    class="px-6 py-4 text-text-primary dark:text-gray-300 font-medium"
                    [ngClass]="{
                      'text-center': h.align === 'center',
                      'text-right': h.align === 'right'
                    }"
                    >
                    <!-- Allow passing row data or fallback to value -->
                    @if (templates[h.key]) {
                      <ng-container *ngTemplateOutlet="templates[h.key]; context: { $implicit: row[h.key], row: row }"></ng-container>
                    } @else {
                      {{ row[h.key] }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
    `
})
export class DataTableComponent {
  @Input() headers: DataTableHeader[] = [];
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() sortKey = '';
  @Input() sortDirection: 'asc' | 'desc' = 'asc';
  
  // Custom templates mapped by column keys for custom rendering
  @Input() templates: { [key: string]: any } = {};

  @Output() sortChange = new EventEmitter<{ key: string; direction: 'asc' | 'desc' }>();

  onHeaderClick(header: DataTableHeader): void {
    if (!header.sortable) return;
    
    let direction: 'asc' | 'desc' = 'asc';
    if (this.sortKey === header.key) {
      direction = this.sortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    this.sortChange.emit({ key: header.key, direction });
  }
}
