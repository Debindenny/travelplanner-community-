import { Component, inject, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface CommunityNews {
  id?: string;
  title: string;
  content: string;
  imageUrl?: string;
  link?: string;
  isActive: boolean;
}

@Component({
    selector: 'app-cms-news',
    imports: [FormsModule],
    template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Community News CMS</h1>
        <button (click)="openCreateModal()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Create News
        </button>
      </div>
    
      <!-- Table -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="p-4 text-sm font-semibold text-slate-600">Image</th>
              <th class="p-4 text-sm font-semibold text-slate-600">Title</th>
              <th class="p-4 text-sm font-semibold text-slate-600">Active</th>
              <th class="p-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (item of news; track item) {
              <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-4">
                  <img [src]="item.imageUrl || 'assets/images/default-thumbnail.jpg'" class="w-16 h-16 object-cover rounded" />
                </td>
                <td class="p-4">
                  <div class="font-medium text-slate-800">{{ item.title }}</div>
                  <div class="text-sm text-slate-500 line-clamp-1">{{ item.content }}</div>
                </td>
                <td class="p-4">
                  <span [class.bg-green-100]="item.isActive" [class.text-green-800]="item.isActive"
                    [class.bg-gray-100]="!item.isActive" [class.text-gray-800]="!item.isActive"
                    class="px-2 py-1 text-xs rounded-full font-medium">
                    {{ item.isActive ? 'Active' : 'Draft' }}
                  </span>
                </td>
                <td class="p-4 space-x-2">
                  <button (click)="openEditModal(item)" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                  <button (click)="deleteNews(item.id!)" class="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    
      <!-- Modal -->
      @if (showModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 class="text-xl font-bold mb-4">{{ isEditing ? 'Edit News' : 'Create News' }}</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input type="text" [(ngModel)]="editingNews.title" class="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea [(ngModel)]="editingNews.content" rows="4" class="w-full px-3 py-2 border rounded"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                <input type="text" [(ngModel)]="editingNews.imageUrl" class="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Link URL</label>
                <input type="text" [(ngModel)]="editingNews.link" class="w-full px-3 py-2 border rounded" />
              </div>
              <div class="flex items-center">
                <input type="checkbox" [(ngModel)]="editingNews.isActive" id="isActive" class="mr-2" />
                <label for="isActive" class="text-sm font-medium text-slate-700">Is Active</label>
              </div>
            </div>
            <div class="mt-6 flex justify-end space-x-3">
              <button (click)="closeModal()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
              <button (click)="saveNews()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      }
    </div>
    `
})
export class CmsNewsComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = `${environment.plannerPath}/admin/cms/news`;

  news: CommunityNews[] = [];
  showModal = false;
  isEditing = false;
  
  editingNews: CommunityNews = {
    title: '',
    content: '',
    isActive: true
  };

  ngOnInit() {
    this.loadNews();
  }

  loadNews() {
    this.http.get<CommunityNews[]>(this.apiUrl).subscribe(data => {
      this.news = data;
    });
  }

  openCreateModal() {
    this.isEditing = false;
    this.editingNews = { title: '', content: '', isActive: true };
    this.showModal = true;
  }

  openEditModal(item: CommunityNews) {
    this.isEditing = true;
    this.editingNews = { ...item };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveNews() {
    if (this.isEditing) {
      this.http.put(`${this.apiUrl}/${this.editingNews.id}`, this.editingNews).subscribe(() => {
        this.loadNews();
        this.closeModal();
      });
    } else {
      this.http.post(this.apiUrl, this.editingNews).subscribe(() => {
        this.loadNews();
        this.closeModal();
      });
    }
  }

  deleteNews(id: string) {
    if (confirm('Are you sure you want to delete this news item?')) {
      this.http.delete(`${this.apiUrl}/${id}`).subscribe(() => {
        this.loadNews();
      });
    }
  }
}
