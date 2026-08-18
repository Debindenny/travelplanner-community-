import { Component, inject, OnInit, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { CmsService, BlogPostData } from '../shared/services/cms.service';

@Component({
    selector: 'app-cms-blogs-page',
    imports: [RouterModule],
    template: `
    <div class="p-8 w-full flex-1 flex flex-col space-y-6 dark:bg-gray-900 min-h-full">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold font-poppins text-gray-900 dark:text-white tracking-tight">Manage Blogs</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Create, edit, and delete blog posts.</p>
        </div>
        <a routerLink="/cms/blogs/new" class="bg-primary text-white flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm shadow-blue-500/20">
          Create New Post
        </a>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-gray-700 shadow-sm flex-1 overflow-hidden">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 uppercase text-xs">
            <tr>
              <th class="py-4 px-6 font-medium">Title</th>
              <th class="py-4 px-6 font-medium">Locale</th>
              <th class="py-4 px-6 font-medium">Author</th>
              <th class="py-4 px-6 font-medium">Published</th>
              <th class="py-4 px-6 font-medium">Category</th>
              <th class="py-4 px-6 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-light dark:divide-gray-700">
            @for (post of posts(); track post.id) {
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td class="py-4 px-6">
                  <p class="font-medium text-gray-900 dark:text-white">{{ post.title }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ post.slug }}</p>
                </td>
                <td class="py-4 px-6 text-gray-600 dark:text-gray-400 uppercase text-xs font-medium">{{ post.locale }}</td>
                <td class="py-4 px-6 text-gray-600 dark:text-gray-400">{{ post.author }}</td>
                <td class="py-4 px-6 text-gray-600 dark:text-gray-400">{{ post.publishedAt }}</td>
                <td class="py-4 px-6">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                    {{ post.categoryLabel }}
                  </span>
                  @if (post.featured) {
                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">Featured</span>
                  }
                </td>
                <td class="py-4 px-6 text-right space-x-3">
                  <a [routerLink]="['/cms/blogs', post.slug, 'edit']" [queryParams]="{ locale: post.locale }" class="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400 transition-colors font-medium">Edit</a>
                  <button (click)="deletePost(post.slug, post.locale)" class="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors font-medium">Delete</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="py-12 text-center text-gray-500 dark:text-gray-400">
                  No blog posts found. Create one to get started!
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CmsBlogsPageComponent implements OnInit {
  private cms = inject(CmsService);
  
  posts = signal<BlogPostData[]>([]);

  ngOnInit() {
    this.loadPosts();
  }

  loadPosts() {
    this.cms.getBlogPosts().subscribe({
      next: (data) => this.posts.set(data),
      error: (err) => console.error('Failed to load posts', err)
    });
  }

  deletePost(slug: string, locale: string) {
    if (confirm(`Are you sure you want to delete post '${slug}'?`)) {
      this.cms.deleteBlogPost(slug, locale).subscribe({
        next: () => this.loadPosts(),
        error: (err) => alert('Failed to delete post.')
      });
    }
  }
}
