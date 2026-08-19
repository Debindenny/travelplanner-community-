import { Component, inject, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CmsService, Destination } from '../shared/services/cms.service';

@Component({
    selector: 'app-cms-destinations',
    imports: [FormsModule],
    templateUrl: './cms-destinations.component.html'
})
export class CmsDestinationsComponent implements OnInit {
  private cmsService = inject(CmsService);
  
  destinations: Destination[] = [];
  isLoading = true;
  showAddModal = false;
  isEditing = false;

  formData: Partial<Destination> = {
    name: '',
    description: '',
    image_url: '',
    base_price: 0,
    region: '',
    tags: []
  };
  tagsInput = '';
  editingId: string | null = null;

  ngOnInit() {
    this.loadDestinations();
  }

  loadDestinations() {
    this.isLoading = true;
    this.cmsService.getDestinations().subscribe({
      next: (data) => {
        this.destinations = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  openAddModal() {
    this.isEditing = false;
    this.editingId = null;
    this.formData = { name: '', description: '', image_url: '', base_price: 0, region: '', tags: [] };
    this.tagsInput = '';
    this.showAddModal = true;
  }

  openEditModal(dest: Destination) {
    this.isEditing = true;
    this.editingId = dest.id;
    this.formData = { ...dest };
    this.tagsInput = dest.tags?.join(', ') || '';
    this.showAddModal = true;
  }

  saveDestination() {
    this.formData.tags = this.tagsInput.split(',').map(t => t.trim()).filter(t => t);
    
    if (this.isEditing && this.editingId) {
      this.cmsService.updateDestination(this.editingId, this.formData).subscribe({
        next: (dest) => {
          const idx = this.destinations.findIndex(d => d.id === dest.id);
          if (idx !== -1) this.destinations[idx] = dest;
          this.showAddModal = false;
        }
      });
    } else {
      this.cmsService.createDestination(this.formData).subscribe({
        next: (dest) => {
          this.destinations.unshift(dest);
          this.showAddModal = false;
        }
      });
    }
  }

  deleteDestination(id: string) {
    if (confirm('Are you sure you want to delete this destination?')) {
      this.cmsService.deleteDestination(id).subscribe({
        next: () => {
          this.destinations = this.destinations.filter(d => d.id !== id);
        }
      });
    }
  }
}
