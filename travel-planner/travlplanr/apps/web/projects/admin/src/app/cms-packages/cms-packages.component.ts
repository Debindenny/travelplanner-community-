import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

export interface PackageData {
  id?: string;
  title: string;
  theme: string;
  price: number;
  days: number;
  group_type: string;
  image_url: string;
  region: string;
  country: string;
  budget_tier: string;
  rating: number;
  itinerary_id: string | null;
}

@Component({
    selector: 'app-cms-packages',
    imports: [CommonModule, FormsModule],
    templateUrl: './cms-packages.component.html',
    styleUrls: ['./cms-packages.component.scss']
})
export class CmsPackagesComponent implements OnInit {
  private http = inject(HttpClient);
  
  packages: PackageData[] = [];
  isLoading = true;
  showModal = false;
  isEditing = false;
  
  currentPackage: PackageData = this.getEmptyPackage();

  ngOnInit(): void {
    this.loadPackages();
  }

  getEmptyPackage(): PackageData {
    return {
      title: '',
      theme: 'Adventure',
      price: 0,
      days: 1,
      group_type: 'Solo',
      image_url: '',
      region: '',
      country: '',
      budget_tier: 'Mid-range',
      rating: 5.0,
      itinerary_id: null
    };
  }

  loadPackages(): void {
    this.isLoading = true;
    this.http.get<{items: any[]}>(`${environment.plannerPath}/admin/cms/packages`).subscribe({
      next: (res) => {
        // Map backend dict to UI Model (handling stringified numeric values if needed)
        this.packages = res.items.map(p => ({
          id: p.id,
          title: p.title,
          theme: p.theme,
          price: parseInt(String(p.price).replace(/[^0-9]/g, '')) || 0,
          days: parseInt(String(p.days).replace(/[^0-9]/g, '')) || 1,
          group_type: p.group,
          image_url: p.image,
          region: p.region,
          country: p.country,
          budget_tier: p.budget,
          rating: parseFloat(p.rating) || 5.0,
          itinerary_id: p.itineraryId
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load packages', err);
        this.isLoading = false;
      }
    });
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.currentPackage = this.getEmptyPackage();
    this.showModal = true;
  }

  openEditModal(pkg: PackageData): void {
    this.isEditing = true;
    this.currentPackage = { ...pkg };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  savePackage(): void {
    if (this.isEditing && this.currentPackage.id) {
      this.http.put(`${environment.plannerPath}/admin/cms/packages/${this.currentPackage.id}`, this.currentPackage).subscribe({
        next: () => {
          this.loadPackages();
          this.closeModal();
        },
        error: (err) => console.error('Update failed', err)
      });
    } else {
      this.http.post(`${environment.plannerPath}/admin/cms/packages`, this.currentPackage).subscribe({
        next: () => {
          this.loadPackages();
          this.closeModal();
        },
        error: (err) => console.error('Create failed', err)
      });
    }
  }

  deletePackage(id: string): void {
    if (confirm('Are you sure you want to delete this package?')) {
      this.http.delete(`${environment.plannerPath}/admin/cms/packages/${id}`).subscribe({
        next: () => this.loadPackages(),
        error: (err) => console.error('Delete failed', err)
      });
    }
  }
}
