import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommunityModerationService } from '../services/community-moderation.service';

export interface ReportReason {
  value: string;
  labelKey: string;
}

@Component({
    selector: 'app-community-report-modal',
    imports: [TranslatePipe, FormsModule],
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl border border-slate-100 dark:border-gray-700 animate-fade-in-up">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3 mb-4">
          <h3 class="font-extrabold text-base text-text-primary dark:text-white flex items-center gap-2">
            <span>🛡️</span> {{ 'COMMUNITY.REPORT.TITLE' | translate }}
          </h3>
          <button (click)="close.emit()" class="text-text-tertiary hover:text-text-primary dark:hover:text-white text-lg focus:outline-none">&times;</button>
        </div>

        <p class="text-xs text-text-secondary dark:text-gray-300 mb-4 leading-normal">
          {{ 'COMMUNITY.REPORT.INSTRUCTION' | translate }}
        </p>

        <!-- Reasons Form -->
        <div class="space-y-2.5">
          @for (reason of reasons; track reason.value) {
            <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
              <input 
                type="radio" 
                name="reportReason" 
                [value]="reason.value" 
                [(ngModel)]="selectedReason"
                class="w-4 h-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              />
              <span class="text-xs font-bold text-text-secondary dark:text-gray-300">
                {{ reason.labelKey | translate }}
              </span>
            </label>
          }
        </div>

        <!-- Additional comments -->
        <div class="mt-4">
          <label class="block text-2xs font-extrabold text-text-tertiary uppercase mb-1.5">{{ 'COMMUNITY.REPORT.DETAILS_LABEL' | translate }}</label>
          <textarea
            [(ngModel)]="details"
            rows="3"
            [placeholder]="'COMMUNITY.REPORT.DETAILS_PLACEHOLDER' | translate"
            class="w-full text-xs p-3 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 text-slate-800 dark:text-white resize-none"
            maxlength="500"
          ></textarea>
          <div class="text-right text-[8px] font-bold text-text-disabled">{{ details.length }}/500</div>
        </div>

        <!-- Footer actions -->
        <div class="mt-5 flex justify-end gap-2 border-t border-slate-100 dark:border-gray-700 pt-4">
          <button 
            (click)="close.emit()" 
            class="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-all"
          >
            {{ 'COMMUNITY.REPORT.CANCEL' | translate }}
          </button>
          <button 
            (click)="submitReport()"
            [disabled]="!selectedReason || isSubmitting()"
            class="px-5 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            @if (isSubmitting()) {
              <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            }
            {{ 'COMMUNITY.REPORT.SUBMIT' | translate }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class CommunityReportModalComponent {
  @Input({ required: true }) targetId!: string;
  @Input({ required: true }) targetType!: 'post' | 'comment' | 'story' | 'user' | 'message';
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<string>();

  private moderationService = inject(CommunityModerationService);
  private translate = inject(TranslateService);

  selectedReason = '';
  details = '';
  isSubmitting = signal(false);

  reasons: ReportReason[] = [
    { value: 'spam', labelKey: 'COMMUNITY.REPORT.REASON_SPAM' },
    { value: 'harassment', labelKey: 'COMMUNITY.REPORT.REASON_HARASSMENT' },
    { value: 'inappropriate', labelKey: 'COMMUNITY.REPORT.REASON_INAPPROPRIATE' },
    { value: 'misinformation', labelKey: 'COMMUNITY.REPORT.REASON_MISINFORMATION' },
    { value: 'copyright', labelKey: 'COMMUNITY.REPORT.REASON_COPYRIGHT' },
  ];

  submitReport() {
    if (!this.selectedReason || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    this.moderationService.createReport({
      target_type: this.targetType,
      target_id: this.targetId,
      reason: this.selectedReason,
      details: this.details || undefined
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitted.emit(this.translate.instant('COMMUNITY.REPORT.SUCCESS'));
      },
      error: () => {
        this.isSubmitting.set(false);
        this.submitted.emit(this.translate.instant('COMMUNITY.REPORT.FAILED'));
      }
    });
  }
}
