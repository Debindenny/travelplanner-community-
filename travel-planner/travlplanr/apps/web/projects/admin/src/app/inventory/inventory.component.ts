import { Component, OnInit, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { InventoryService } from '../shared/services/inventory.service';
import { INVENTORY_TABS, InventoryItem, InventoryType } from '../shared/models/inventory.model';
import { SkeletonComponent, EmptyStateComponent } from 'ui';

@Component({
    selector: 'app-inventory',
    imports: [FormsModule, SkeletonComponent, EmptyStateComponent],
    templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit {
  private inventoryService = inject(InventoryService);

  readonly tabs = INVENTORY_TABS;
  activeTab: InventoryType = 'hotel';
  items: InventoryItem[] = [];
  isLoading = false;
  errorMessage = '';

  location = 'Paris';
  dep = 'PAR';
  arr = 'LON';
  date = '';
  budget = 'standard';

  ngOnInit(): void {
    this.search();
  }

  selectTab(tab: InventoryType): void {
    this.activeTab = tab;
    this.search();
  }

  search(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const usesRoute = this.activeTab === 'flight' || this.activeTab === 'train' || this.activeTab === 'bus';
    const usesLocation = this.activeTab === 'hotel' || this.activeTab === 'car' || this.activeTab === 'activity' || this.activeTab === 'place';

    this.inventoryService
      .search({
        type: this.activeTab,
        location: usesLocation ? this.location : undefined,
        dep: usesRoute ? this.dep : undefined,
        arr: usesRoute ? this.arr : undefined,
        date: this.activeTab === 'flight' && this.date ? this.date : undefined,
        budget: this.budget,
      })
      .subscribe({
        next: (items) => {
          this.items = items;
          this.isLoading = false;
          if (items.length === 0) {
            this.errorMessage = 'No results found. Run scripts/seed_inventory.py to load sample inventory.';
          }
        },
        error: () => {
          this.items = [];
          this.isLoading = false;
          this.errorMessage = 'Could not load inventory. Ensure planner service and gateway are running, then run seed_inventory.py.';
        },
      });
  }

  formatPrice(item: InventoryItem): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: item.currency || 'USD',
    }).format(item.price);
  }

  detailSummary(item: InventoryItem): string {
    if (!item.details) return '—';
    const parts = Object.entries(item.details)
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${value}`);
    return parts.join(' · ') || '—';
  }

  get activeTabLabel(): string {
    return this.tabs.find((t) => t.id === this.activeTab)?.label ?? 'Inventory';
  }
}
