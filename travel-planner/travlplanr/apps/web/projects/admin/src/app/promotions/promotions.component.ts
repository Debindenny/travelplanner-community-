import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmsService, Promotion } from '../shared/services/cms.service';

@Component({
    selector: 'app-promotions',
    imports: [CommonModule, FormsModule],
    templateUrl: './promotions.component.html'
})
export class PromotionsComponent implements OnInit {
  private cmsService = inject(CmsService);
  
  promotions: Promotion[] = [];
  isLoading = true;
  showAddModal = false;

  newPromo = {
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    valid_until: '',
    is_active: true
  };

  ngOnInit() {
    this.loadPromotions();
  }

  loadPromotions() {
    this.isLoading = true;
    this.cmsService.getPromotions().subscribe({
      next: (data) => {
        this.promotions = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  savePromotion() {
    const data = {
      ...this.newPromo,
      valid_until: new Date(this.newPromo.valid_until).toISOString()
    };
    this.cmsService.createPromotion(data).subscribe({
      next: (promo) => {
        this.promotions.unshift(promo);
        this.showAddModal = false;
      }
    });
  }

  toggleStatus(promo: Promotion) {
    const newStatus = !promo.is_active;
    this.cmsService.updatePromotionStatus(promo.id, newStatus).subscribe({
      next: () => promo.is_active = newStatus
    });
  }

  deletePromotion(id: string) {
    if (confirm('Are you sure you want to delete this promotion?')) {
      this.cmsService.deletePromotion(id).subscribe({
        next: () => {
          this.promotions = this.promotions.filter(p => p.id !== id);
        }
      });
    }
  }
}
