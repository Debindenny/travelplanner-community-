import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmsService, Review } from '../shared/services/cms.service';

@Component({
    selector: 'app-reviews',
    imports: [CommonModule, FormsModule],
    templateUrl: './reviews.component.html'
})
export class ReviewsComponent implements OnInit {
  private cmsService = inject(CmsService);
  
  reviews: Review[] = [];
  isLoading = true;
  statusFilter = '';

  ngOnInit() {
    this.loadReviews();
  }

  loadReviews() {
    this.isLoading = true;
    this.cmsService.getReviews(this.statusFilter).subscribe({
      next: (data) => {
        this.reviews = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  onFilterChange() {
    this.loadReviews();
  }

  updateStatus(review: Review, status: string) {
    this.cmsService.updateReviewStatus(review.id, status).subscribe({
      next: (updated) => {
        review.status = updated.status;
      }
    });
  }

  deleteReview(id: string) {
    if (confirm('Are you sure you want to permanently delete this review?')) {
      this.cmsService.deleteReview(id).subscribe({
        next: () => {
          this.reviews = this.reviews.filter(r => r.id !== id);
        }
      });
    }
  }

  getStarArray(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }
}
