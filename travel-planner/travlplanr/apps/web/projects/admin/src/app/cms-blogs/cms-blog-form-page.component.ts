import { Component, inject, OnInit, OnDestroy, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CmsService, BlogPostData } from '../shared/services/cms.service';
import { QuillModule, QuillEditorComponent } from 'ngx-quill';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { MediaLibraryModalComponent } from './components/media-library-modal.component';

function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const allElements = doc.body.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'script' || tagName === 'iframe' || tagName === 'object' || tagName === 'embed' || tagName === 'link' || tagName === 'meta' || tagName === 'style') {
        el.parentNode?.removeChild(el);
        continue;
      }
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        const attrVal = attr.value.toLowerCase().trim();
        if (attrName.startsWith('on') || attrVal.startsWith('javascript:') || attrVal.startsWith('data:') || attrName === 'formaction') {
          el.removeAttribute(attr.name);
        }
      }
    }
    return doc.body.innerHTML;
  } catch (e) {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
}

@Component({
    selector: 'app-cms-blog-form-page',
    imports: [CommonModule, ReactiveFormsModule, RouterModule, QuillModule, MediaLibraryModalComponent],
    template: `
    @if (!showPreview()) {
      <div class="p-8 w-full flex-1 flex flex-col space-y-6 dark:bg-gray-900 min-h-full">
        <div class="mb-2 flex justify-between items-end">
          <div>
            <a routerLink="/cms/blogs" class="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400 mb-2 inline-flex items-center text-sm font-medium transition-colors">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Back to Blogs
            </a>
            <h1 class="text-2xl font-bold font-poppins text-gray-900 dark:text-white tracking-tight">{{ isEditing() ? 'Edit Blog Post' : 'Create New Post' }}</h1>
          </div>
          <div class="flex items-center gap-3">
            @if (lastSaved()) {
              <span class="text-xs text-gray-500 dark:text-gray-400">Draft saved: {{ lastSaved() | date:'mediumTime' }}</span>
            }
            <button type="button" (click)="togglePreview()" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 shadow-sm transition-colors">
              Live Preview
            </button>
          </div>
        </div>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Core Content Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-gray-700 shadow-sm p-6 space-y-5">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Core Content</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
                <input type="text" formControlName="title" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="E.g., 10 Hidden Gems in Asia">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Slug</label>
                <input type="text" formControlName="slug" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="E.g., hidden-gems-asia">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Locale</label>
                <select formControlName="locale" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors">
                  <option value="en">English (en)</option>
                  <option value="es">Español (es)</option>
                  <option value="fr">Français (fr)</option>
                </select>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Same slug can exist once per locale — this is a separate translated copy, not a language toggle for one post.</p>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Excerpt</label>
              <textarea formControlName="excerpt" rows="2" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Short summary for the card..."></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Content</label>
              <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden h-96 flex flex-col">
                <quill-editor formControlName="content"
                  placeholder="Write your post content here..."
                  [modules]="quillModules"
                  class="flex-1 overflow-y-auto">
                </quill-editor>
              </div>
            </div>
          </div>
          <!-- Metadata Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-gray-700 shadow-sm p-6 space-y-5">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Publishing & Metadata</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cover Image URL</label>
                <input type="text" formControlName="image_url" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="assets/images/... or https://...">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Author</label>
                <input type="text" formControlName="author" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="E.g., John Doe">
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Published Date string</label>
                <input type="text" formControlName="published_at" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="E.g., Jun 15, 2025">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Read Time</label>
                <input type="text" formControlName="read_time" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="E.g., 5 min read">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                <select formControlName="status" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category ID & Label</label>
                <div class="flex gap-3">
                  <input type="text" formControlName="category" class="w-1/2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors" placeholder="ID (e.g. destinations)">
                  <input type="text" formControlName="category_label" class="w-1/2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors" placeholder="Label (e.g. Destinations)">
                </div>
              </div>
              <div class="flex items-center pt-6 pl-2">
                <label class="flex items-center cursor-pointer">
                  <input type="checkbox" formControlName="featured" class="w-5 h-5 text-primary bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700 rounded focus:ring-primary focus:ring-2">
                  <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Featured Post</span>
                </label>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tags</label>
              <div class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 min-h-[46px] flex flex-wrap gap-2 items-center focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-colors">
                @for (tag of tags(); track tag) {
                  <span class="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                    {{ tag }}
                    <button type="button" (click)="removeTag(tag)" class="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 focus:outline-none">&times;</button>
                  </span>
                }
                <input type="text" (keydown.enter)="addTag($event)" placeholder="Type and press enter..." class="flex-1 bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 min-w-[150px]">
              </div>
            </div>
          </div>
          <!-- SEO Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-gray-700 shadow-sm p-6 space-y-5">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">SEO Settings</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div class="space-y-5">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Meta Title</label>
                  <input type="text" formControlName="meta_title" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary" placeholder="SEO Title...">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target Keywords</label>
                  <input type="text" formControlName="target_keywords" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary" placeholder="Comma separated keywords">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Meta Description</label>
                  <textarea formControlName="meta_description" rows="3" class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary" placeholder="SEO Description..."></textarea>
                </div>
                <button type="button" (click)="generateSEO()" [disabled]="generatingSeo()" class="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  @if (!generatingSeo()) {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  }
                  @if (generatingSeo()) {
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  }
                  {{ generatingSeo() ? 'Generating with AI...' : 'Auto-Generate with AI' }}
                </button>
              </div>
              <div class="space-y-5">
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Google Search Preview</h3>
                  <div class="max-w-[600px]">
                    <div class="text-sm text-[#202124] dark:text-[#dadce0] truncate mb-1">https://travlplanr.com/blog/{{ form.value.slug || 'your-slug' }}</div>
                    <div class="text-xl text-[#1a0dab] dark:text-[#8ab4f8] font-medium truncate mb-1 hover:underline cursor-pointer">
                      {{ form.value.meta_title || form.value.title || 'Your Blog Post Title' }}
                    </div>
                    <div class="text-sm text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2">
                      <span class="text-gray-500 dark:text-gray-400">{{ form.value.published_at || 'Jan 1, 2025' }} — </span>
                      {{ form.value.meta_description || form.value.excerpt || 'Write a compelling excerpt or meta description to see how it will appear in search results.' }}
                    </div>
                  </div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Social Media (Twitter/FB) Preview</h3>
                  <div class="max-w-[500px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                    <div class="h-64 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                      @if (form.value.image_url) {
                        <img [src]="form.value.image_url" class="w-full h-full object-cover">
                      }
                      @if (!form.value.image_url) {
                        <div class="absolute inset-0 flex items-center justify-center text-gray-400">No Image</div>
                      }
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <div class="text-xs text-gray-500 mb-1 uppercase">travlplanr.com</div>
                      <div class="font-semibold text-gray-900 dark:text-white line-clamp-1 mb-1">
                        {{ form.value.meta_title || form.value.title || 'Your Blog Post Title' }}
                      </div>
                      <div class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {{ form.value.meta_description || form.value.excerpt || 'Write a compelling excerpt to see how it will appear.' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="pt-2 flex justify-end gap-3 pb-8">
            <div class="flex items-center gap-2 mt-4 md:mt-0">
              @if (isEditing()) {
                <button type="button" (click)="loadRevisions()" class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  History
                </button>
              }
              <button type="button" routerLink="/cms/blogs" class="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" [disabled]="form.invalid || saving()" class="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm shadow-blue-500/20">
                @if (saving()) {
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                }
                {{ isEditing() ? 'Update Post' : (form.value.status === 'draft' ? 'Save Draft' : 'Publish Post') }}
              </button>
            </div>
          </div>
        </form>
      </div>
    }
    
    <!-- Live Preview Overlay -->
    @if (showPreview()) {
      <div class="fixed inset-0 z-50 bg-white dark:bg-[#0a0a0a] overflow-y-auto">
        <div class="sticky top-0 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-sm z-10">
          <div class="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
            <span class="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            Live Preview Mode
          </div>
          <button (click)="togglePreview()" class="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors">
            Exit Preview
          </button>
        </div>
        <!-- Content replicating public blog-post-page.component.ts layout -->
        <main class="pt-16 pb-24 text-gray-900 dark:text-white">
          <article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <header class="mb-10 text-center">
              <div class="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium tracking-wide uppercase">
                <span class="text-primary">{{ form.value.category_label || 'Category' }}</span>
                <span>•</span>
                <span>{{ form.value.published_at || 'Date' }}</span>
                <span>•</span>
                <span>{{ form.value.read_time || 'Read Time' }}</span>
              </div>
              <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold font-poppins text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
                {{ form.value.title || 'Your Blog Title' }}
              </h1>
              <p class="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                {{ form.value.excerpt || 'Your engaging excerpt will appear here.' }}
              </p>
            </header>
            <div class="mb-12 rounded-2xl overflow-hidden aspect-[21/9] bg-gray-100 dark:bg-gray-800 relative group shadow-lg">
              @if (form.value.image_url) {
                <img [src]="form.value.image_url" alt="Cover" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              }
              @if (!form.value.image_url) {
                <div class="absolute inset-0 bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <span class="text-gray-400 dark:bg-gray-500">Cover Image Placeholder</span>
                </div>
              }
            </div>
            <div class="prose prose-lg md:prose-xl dark:prose-invert prose-blue max-w-none mx-auto mb-16" [innerHTML]="getSanitizedContent()">
            </div>
            <div class="border-t border-border-light dark:border-gray-800 pt-8 mt-12 flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center border border-blue-200 dark:border-blue-800/50">
                  <span class="text-blue-700 dark:text-blue-300 font-bold text-lg">{{ (form.value.author || 'A').charAt(0) }}</span>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ form.value.author || 'Author Name' }}</h3>
                  <p class="text-gray-500 dark:text-gray-400 text-sm">Travel Writer & Explorer</p>
                </div>
              </div>
            </div>
          </article>
        </main>
      </div>
    }
    
    <!-- Media Library Modal -->
    @if (showMediaLibrary()) {
      <app-media-library-modal
        (close)="showMediaLibrary.set(false)"
        (insert)="onMediaInsert($event)">
      </app-media-library-modal>
    }
    
    <!-- Revision History Modal -->
    @if (showRevisionHistory()) {
      <div class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Revision History</h2>
            <button (click)="showRevisionHistory.set(false)" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
            @if (revisions().length === 0) {
              <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                No revisions found for this post.
              </div>
            }
            @if (revisions().length > 0) {
              <div class="space-y-4">
                @for (rev of revisions(); track rev) {
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">{{ rev.created_at | date:'medium' }}</p>
                      <p class="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{{ rev.title }}</p>
                    </div>
                    <button (click)="restoreRevision(rev)" class="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                      Restore
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
    `
})
export class CmsBlogFormPageComponent implements OnInit, OnDestroy {
  @ViewChild(QuillEditorComponent) editor: QuillEditorComponent | undefined;
  
  private fb = inject(FormBuilder);
  private cms = inject(CmsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  isEditing = signal(false);
  originalSlug = signal<string | null>(null);
  // The locale the post was actually loaded with — needed to look up the
  // right row on update even if the admin changes `locale` in the form
  // itself (that's an intentional edit, not how we find the existing row).
  originalLocale = signal<string>('en');
  saving = signal(false);
  generatingSeo = signal(false);
  showMediaLibrary = signal(false);
  showRevisionHistory = signal(false);
  revisions = signal<any[]>([]);
  
  tags = signal<string[]>([]);
  showPreview = signal(false);
  lastSaved = signal<Date | null>(null);

  form: FormGroup = this.fb.group({
    title: ['', Validators.required],
    slug: ['', Validators.required],
    locale: ['en', Validators.required],
    excerpt: ['', Validators.required],
    content: ['', Validators.required],
    image_url: ['', Validators.required],
    author: ['', Validators.required],
    published_at: ['', Validators.required],
    read_time: ['', Validators.required],
    category: ['', Validators.required],
    category_label: ['', Validators.required],
    featured: [false],
    status: ['published'],
    meta_title: [''],
    meta_description: [''],
    target_keywords: ['']
  });

  quillModules = {
    syntax: true,
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'header': 1 }, { 'header': 2 }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['clean'],
        ['link', 'image', 'video']
      ],
      handlers: {
        image: this.imageHandler.bind(this)
      }
    }
  };

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      const locale = this.route.snapshot.queryParamMap.get('locale') || 'en';
      this.isEditing.set(true);
      this.originalSlug.set(slug);
      this.originalLocale.set(locale);
      this.loadPost(slug, locale);
    } else {
      // Auto-load draft if creating a new post
      const draft = localStorage.getItem('blog_draft');
      if (draft) {
        try {
          const data = JSON.parse(draft);
          this.form.patchValue(data);
          if (data.tags) {
            this.tags.set(JSON.parse(data.tags));
          }
        } catch (e) {}
      }
    }

    // Auto-save logic
    this.form.valueChanges.pipe(
      debounceTime(3000),
      takeUntil(this.destroy$)
    ).subscribe(val => {
      if (!this.isEditing()) {
        const toSave = { ...val, tags: JSON.stringify(this.tags()) };
        localStorage.setItem('blog_draft', JSON.stringify(toSave));
        this.lastSaved.set(new Date());
      }
    });

    // Auto-slug generation
    this.form.get('title')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(title => {
      const slugControl = this.form.get('slug');
      if (slugControl && slugControl.pristine && !this.isEditing()) {
        const slug = title?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        slugControl.setValue(slug, { emitEvent: false });
      }
    });

    // Auto-read time calculation
    this.form.get('content')?.valueChanges.pipe(
      debounceTime(500),
      takeUntil(this.destroy$)
    ).subscribe(content => {
      if (content) {
        // Strip HTML
        const text = content.replace(/<[^>]*>/g, ' ');
        const words = text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
        const readTime = Math.max(1, Math.ceil(words / 200));
        this.form.patchValue({ read_time: `${readTime} min read` }, { emitEvent: false });
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPost(slug: string, locale = 'en') {
    this.cms.getBlogPost(slug, locale).subscribe({
      next: (post) => {
        this.form.patchValue({
          title: post.title,
          slug: post.slug,
          locale: post.locale,
          excerpt: post.excerpt,
          content: post.content,
          image_url: post.image,
          author: post.author,
          published_at: post.publishedAt,
          read_time: post.readTime,
          category: post.category,
          category_label: post.categoryLabel,
          featured: post.featured,
          status: post.status || 'published',
          meta_title: post.metaTitle || '',
          meta_description: post.metaDescription || '',
          target_keywords: post.targetKeywords || ''
        });
        
        if (post.tags) {
          try { this.tags.set(JSON.parse(post.tags)); } catch(e) {}
        }
      },
      error: () => {
        alert('Failed to load blog post');
        this.router.navigate(['/cms/blogs']);
      }
    });
  }

  imageHandler() {
    this.showMediaLibrary.set(true);
  }

  onMediaInsert(url: string) {
    this.showMediaLibrary.set(false);
    const range = this.editor?.quillEditor.getSelection();
    // Default to the end if no range
    const index = range ? range.index : (this.editor?.quillEditor.getLength() || 0);
    this.editor?.quillEditor.insertEmbed(index, 'image', url);
  }

  addTag(event: any) {
    const value = event.target.value.trim();
    if (value && !this.tags().includes(value)) {
      this.tags.update(t => [...t, value]);
    }
    event.target.value = '';
  }

  removeTag(tagToRemove: string) {
    this.tags.update(tags => tags.filter(tag => tag !== tagToRemove));
  }

  loadRevisions() {
    const slug = this.originalSlug();
    if (slug) {
      this.cms.getRevisions(slug, this.originalLocale()).subscribe({
        next: (revs) => {
          this.revisions.set(revs);
          this.showRevisionHistory.set(true);
        },
        error: () => alert('Failed to load revisions')
      });
    }
  }

  restoreRevision(rev: any) {
    if (confirm('Are you sure you want to restore this revision? Your current unsaved changes will be lost.')) {
      this.form.patchValue({
        title: rev.title,
        content: rev.content,
        excerpt: rev.excerpt
      });
      this.showRevisionHistory.set(false);
      alert('Revision restored! Click Update to save changes.');
    }
  }

  getSanitizedContent(): string {
    const raw = this.form.value.content;
    if (!raw) return '<p>Start writing your content to see it previewed here.</p>';
    return sanitizeHtml(raw);
  }

  togglePreview() {
    this.showPreview.set(!this.showPreview());
  }

  generateSEO() {
    const title = this.form.value.title;
    const content = this.form.value.content;
    
    if (!content || !title) {
      alert("Please fill in Title and Content first to generate SEO.");
      return;
    }

    this.generatingSeo.set(true);
    this.cms.generateSEO(title, content).subscribe({
      next: (res: any) => {
        this.form.patchValue({
          meta_title: res.meta_title,
          meta_description: res.meta_description,
          excerpt: res.excerpt,
          target_keywords: res.target_keywords
        });
        
        if (res.tags && Array.isArray(res.tags)) {
           res.tags.forEach((tag: string) => {
             if (!this.tags().includes(tag)) {
               this.tags.update(t => [...t, tag]);
             }
           });
        }
        this.generatingSeo.set(false);
      },
      error: () => {
        alert("Failed to generate SEO from AI.");
        this.generatingSeo.set(false);
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      alert("Please fill all required fields.");
      return;
    }
    
    this.saving.set(true);
    const data = { 
      ...this.form.value, 
      tags: JSON.stringify(this.tags()) 
    };

    if (this.isEditing() && this.originalSlug()) {
      this.cms.updateBlogPost(this.originalSlug()!, data, this.originalLocale()).subscribe({
        next: () => {
          this.router.navigate(['/cms/blogs']);
        },
        error: (err) => {
          alert('Failed to update post: ' + err.error?.detail || err.message);
          this.saving.set(false);
        }
      });
    } else {
      this.cms.createBlogPost(data).subscribe({
        next: () => {
          localStorage.removeItem('blog_draft'); // Clear draft on success
          this.router.navigate(['/cms/blogs']);
        },
        error: (err) => {
          alert('Failed to create post: ' + err.error?.detail || err.message);
          this.saving.set(false);
        }
      });
    }
  }
}
