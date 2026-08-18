import { Component, signal, Input, OnInit, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

interface ChecklistItem {
  id: string;
  labelKey: string;
  link?: string;
  linkLabelKey?: string;
}

const CHECKLIST: ChecklistItem[] = [
  { id: 'post', labelKey: 'COMMUNITY.ONBOARDING.ITEM_POST', link: undefined, linkLabelKey: 'COMMUNITY.ONBOARDING.LINK_POST_NOW' },
  { id: 'follow3', labelKey: 'COMMUNITY.ONBOARDING.ITEM_FOLLOW3', link: '/community', linkLabelKey: 'COMMUNITY.ONBOARDING.LINK_EXPLORE' },
  { id: 'save1', labelKey: 'COMMUNITY.ONBOARDING.ITEM_SAVE1', link: '/community', linkLabelKey: 'COMMUNITY.ONBOARDING.LINK_BROWSE' },
  { id: 'clone1', labelKey: 'COMMUNITY.ONBOARDING.ITEM_CLONE1', link: '/community', linkLabelKey: 'COMMUNITY.ONBOARDING.LINK_DISCOVER' },
];

const STORAGE_KEY = 'community_onboarding_completed';

@Component({
    selector: 'app-community-onboarding',
    imports: [RouterLink, TranslatePipe],
    template: `
    @if (!dismissed()) {
      <div class="bg-gradient-to-br from-indigo-50 to-primary-50 border border-primary-subtle/40 rounded-2xl p-4 shadow-sm animate-fade-in-up">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.ONBOARDING.TITLE' | translate }}</h3>
          <button (click)="dismiss()" class="text-text-disabled hover:text-text-tertiary focus:outline-none" [attr.aria-label]="'COMMUNITY.ONBOARDING.DISMISS' | translate">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Progress bar -->
        <div class="mb-3">
          <div class="flex justify-between text-[9px] font-extrabold text-text-tertiary mb-1">
            <span>{{ 'COMMUNITY.ONBOARDING.COMPLETED_COUNT' | translate: { done: completedCount(), total: checklist.length } }}</span>
            <span class="text-primary">{{ Math.round(completedCount() / checklist.length * 100) }}%</span>
          </div>
          <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500"
              [style.width.%]="completedCount() / checklist.length * 100"
            ></div>
          </div>
        </div>

        <ul class="space-y-2">
          @for (item of checklist; track item.id) {
            <li class="flex items-center gap-2.5">
              <button
                (click)="toggleItem(item.id)"
                class="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all focus:outline-none"
                [class.bg-primary]="isCompleted(item.id)"
                [class.border-primary]="isCompleted(item.id)"
                [class.border-slate-300]="!isCompleted(item.id)"
                [class.bg-white]="!isCompleted(item.id)"
                [attr.aria-label]="toggleAriaLabel(item)"
              >
                @if (isCompleted(item.id)) {
                  <svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                }
              </button>
              <span
                class="text-xs text-text-primary flex-1 min-w-0"
                [class.line-through]="isCompleted(item.id)"
                [class.text-text-disabled]="isCompleted(item.id)"
                [translate]="item.labelKey"
              ></span>
              @if (!isCompleted(item.id) && item.link && item.linkLabelKey) {
                <a
                  [routerLink]="item.link"
                  class="text-2xs font-bold text-primary hover:underline shrink-0"
                  [translate]="item.linkLabelKey"
                ></a>
              }
            </li>
          }
        </ul>
      </div>
    }
  `
})
export class CommunityOnboardingComponent implements OnInit {
  @Input() onPostClick: (() => void) | undefined;

  private translate = inject(TranslateService);

  checklist = CHECKLIST;
  dismissed = signal(false);
  completedIds = signal(new Set<string>());
  Math = Math;

  toggleAriaLabel(item: ChecklistItem): string {
    const label = this.translate.instant(item.labelKey);
    const key = this.isCompleted(item.id) ? 'COMMUNITY.ONBOARDING.MARK_NOT_DONE' : 'COMMUNITY.ONBOARDING.MARK_DONE';
    return this.translate.instant(key, { label });
  }

  ngOnInit() {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dismissed') {
        this.dismissed.set(true);
        return;
      }
      try {
        const ids: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY + '_ids') || '[]');
        this.completedIds.set(new Set(ids));
      } catch {}
    }
  }

  completedCount() {
    return this.completedIds().size;
  }

  isCompleted(id: string): boolean {
    return this.completedIds().has(id);
  }

  toggleItem(id: string) {
    const ids = new Set(this.completedIds());
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    this.completedIds.set(ids);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY + '_ids', JSON.stringify([...ids]));
    }
  }

  dismiss() {
    this.dismissed.set(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'dismissed');
    }
  }
}
