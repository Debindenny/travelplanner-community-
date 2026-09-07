import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunityEventsMockStore, CURRENT_USER_ID } from '../services/community-events-mock.store';
import { CommunityEventCard, unsplashUrl } from '../services/community-event-view.model';

type StepKind = 'text' | 'textarea' | 'date' | 'number' | 'single' | 'multi' | 'image';

interface Answers {
  destination: string;
  startLocation: string;
  differentEnd: 'Yes' | 'No' | '';
  endLocation: string;
  startDate: string;
  endDate: string;
  smartDates: string;
  tripType: string;
  travelStyle: string[];
  transportation: string[];
  journeyName: string;
  description: string;
  minTravelers: string;
  maxTravelers: string;
  minimumStay: string;
  partialParticipation: string;
  coverImage: 'Upload Image' | 'Skip' | '';
}

type AnswerKey = keyof Answers;

interface StepDef {
  key: AnswerKey;
  kind: StepKind;
  prompt: string;
  options?: string[];
  placeholder?: string;
  visible?: (a: Answers) => boolean;
}

interface HistoryEntry {
  index: number;
  key: AnswerKey;
  prompt: string;
  answerText: string;
  note?: string;
}

interface ReviewRow {
  label: string;
  value: string;
}

const DRAFT_KEY = 'community-host-event-chat-draft-v1';

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultAnswers(): Answers {
  return {
    destination: '',
    startLocation: '',
    differentEnd: '',
    endLocation: '',
    startDate: '',
    endDate: '',
    smartDates: '',
    tripType: '',
    travelStyle: [],
    transportation: [],
    journeyName: '',
    description: '',
    minTravelers: '',
    maxTravelers: '',
    minimumStay: '',
    partialParticipation: '',
    coverImage: ''
  };
}

const STEPS: StepDef[] = [
  { key: 'destination', kind: 'text', prompt: 'Where are you going?', placeholder: 'e.g. Bali, Indonesia' },
  { key: 'startLocation', kind: 'text', prompt: 'Where does the trip start from?', placeholder: 'e.g. Mumbai, India' },
  {
    key: 'differentEnd',
    kind: 'single',
    prompt: 'Will the trip end at a different location from where it starts?',
    options: ['Yes', 'No']
  },
  {
    key: 'endLocation',
    kind: 'text',
    prompt: 'Where does the trip end?',
    placeholder: 'e.g. Kuala Lumpur, Malaysia',
    visible: (a) => a.differentEnd === 'Yes'
  },
  { key: 'startDate', kind: 'date', prompt: 'When does the trip start?' },
  { key: 'endDate', kind: 'date', prompt: 'When does the trip end?' },
  {
    key: 'smartDates',
    kind: 'single',
    prompt: 'Would you like me to suggest the best travel dates based on weather, local events, and pricing for your destination?',
    options: ['Yes, suggest dates', "No, I'll choose my own dates"]
  },
  {
    key: 'tripType',
    kind: 'single',
    prompt: 'What type of trip are you hosting?',
    options: ['Hosted Group Trip', 'Solo Adventure', 'Couples Getaway', 'Family Trip', 'Business Trip']
  },
  {
    key: 'travelStyle',
    kind: 'multi',
    prompt: 'What travel style best describes this trip?',
    options: ['Adventure', 'Cultural', 'Relaxation', 'Business', 'City Exploration', 'Nature & Wildlife', 'Foodie', 'Nightlife', 'Shopping']
  },
  {
    key: 'transportation',
    kind: 'multi',
    prompt: 'What transportation options will be available during the trip?',
    options: ['Rental Car', 'Cab / Ride Service']
  },
  { key: 'journeyName', kind: 'text', prompt: 'What would you like to call this journey?', placeholder: 'e.g. Bali Sunrise Circuit' },
  {
    key: 'description',
    kind: 'textarea',
    prompt: 'Tell travelers about this trip. What makes it special?',
    placeholder: "The vibe, the pace, why you're hosting it…"
  },
  { key: 'minTravelers', kind: 'number', prompt: 'What is the minimum number of travelers required for this trip?', placeholder: 'e.g. 4' },
  { key: 'maxTravelers', kind: 'number', prompt: 'What is the maximum number of travelers allowed?', placeholder: 'e.g. 12' },
  {
    key: 'minimumStay',
    kind: 'single',
    prompt: 'Is there a minimum stay requirement?',
    options: ['No Minimum Stay', '1 Day', '2 Days', '3 Days', 'Full Trip Required']
  },
  {
    key: 'partialParticipation',
    kind: 'single',
    prompt: 'Can travelers join only part of the trip?',
    options: ['Yes, partial participation allowed', 'No, full participation required']
  },
  {
    key: 'coverImage',
    kind: 'image',
    prompt: 'Would you like to upload a cover image for this event?',
    options: ['Upload Image', 'Skip']
  }
];

@Component({
  selector: 'app-community-host-event',
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto py-8 px-4 sm:px-6 font-manrope">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 mb-5 text-[12.5px] font-bold text-eventText-soft">
        <a routerLink="/community/events" class="hover:text-primary transition-colors">Events</a>
        <span class="text-slate-300 dark:text-gray-600">/</span>
        <span class="font-extrabold text-eventText-deep dark:text-white">Host an event</span>
      </nav>

      <div class="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 sm:px-8 pt-7 pb-5">
          <div class="flex items-center gap-2.5 mb-1.5">
            <span class="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4L12 2Z" />
                <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
              </svg>
            </span>
            <h1 class="font-manrope text-2xl font-black text-eventText-deep dark:text-white">Host an event</h1>
          </div>
          <p class="text-sm text-eventText-mid dark:text-gray-300">
            Answer a few quick questions in chat and I'll put your event together — no forms.
          </p>

          <!-- Progress -->
          <div *ngIf="!reviewMode && !showResumePrompt" class="mt-5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] font-extrabold text-eventText-soft uppercase tracking-wide">
                Question {{ currentQuestionNumber }} of {{ totalVisibleSteps }}
              </span>
            </div>
            <div class="h-1.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all duration-300" [style.width.%]="progressPercent"></div>
            </div>
          </div>
        </div>

        <div class="h-px bg-slate-100 dark:bg-gray-700"></div>

        <!-- Resume draft prompt -->
        <div *ngIf="showResumePrompt" class="px-6 sm:px-8 py-8 flex flex-col items-start gap-3">
          <ng-container *ngTemplateOutlet="botBubble; context: { text: 'Welcome back — you have a saved draft for this event. Want to pick up where you left off?' }"></ng-container>
          <div class="flex gap-2 ml-9">
            <button type="button" (click)="resumeDraft()" class="h-9 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors">
              Resume draft
            </button>
            <button type="button" (click)="discardDraft()" class="h-9 px-4 rounded-full border border-slate-200 dark:border-gray-700 text-xs font-bold text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors">
              Start fresh
            </button>
          </div>
        </div>

        <!-- Editing hint -->
        <div *ngIf="editingHint && !reviewMode && !showResumePrompt" class="mx-6 sm:mx-8 mt-4 px-4 py-2.5 rounded-xl bg-primary-50 dark:bg-primary/10 text-primary text-xs font-bold flex items-center justify-between gap-3">
          <span>Tap the pencil on any of your answers below to change it.</span>
          <button type="button" (click)="backToReview()" class="shrink-0 underline hover:no-underline">Back to review</button>
        </div>

        <!-- Chat transcript -->
        <div *ngIf="!reviewMode && !showResumePrompt" #transcript class="px-6 sm:px-8 py-6 flex flex-col gap-4 max-h-[52vh] overflow-y-auto">
          <ng-container *ngFor="let entry of history">
            <ng-container *ngTemplateOutlet="botBubble; context: { text: entry.prompt }"></ng-container>
            <ng-container *ngTemplateOutlet="userBubble; context: { entry: entry }"></ng-container>
            <ng-container *ngIf="entry.note" [ngTemplateOutlet]="botBubble" [ngTemplateOutletContext]="{ text: entry.note }"></ng-container>
          </ng-container>

          <ng-container *ngIf="currentStep">
            <ng-container *ngTemplateOutlet="botBubble; context: { text: currentStep.prompt }"></ng-container>
          </ng-container>

          <div *ngIf="botTyping" class="flex items-start gap-2.5">
            <span class="w-7 h-7 rounded-full bg-primary-50 dark:bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4L12 2Z" />
              </svg>
            </span>
            <div class="bg-slate-50 dark:bg-gray-700/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-eventText-soft animate-bounce" style="animation-delay:0ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-eventText-soft animate-bounce" style="animation-delay:120ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-eventText-soft animate-bounce" style="animation-delay:240ms"></span>
            </div>
          </div>
        </div>

        <!-- Composer -->
        <div *ngIf="currentStep && !botTyping && !reviewMode && !showResumePrompt" class="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-gray-700 flex flex-col gap-2.5">
          <ng-container [ngSwitch]="currentStep.kind">
            <div *ngSwitchCase="'text'" class="flex items-center gap-2">
              <input
                type="text"
                [(ngModel)]="draftText"
                [placeholder]="currentStep.placeholder || ''"
                (keydown.enter)="submitText()"
                autocomplete="off"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="button" (click)="submitText()" class="h-11 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0">Send</button>
            </div>

            <div *ngSwitchCase="'number'" class="flex items-center gap-2">
              <input
                type="number"
                min="1"
                [(ngModel)]="draftText"
                [placeholder]="currentStep.placeholder || ''"
                (keydown.enter)="submitText()"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="button" (click)="submitText()" class="h-11 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0">Send</button>
            </div>

            <div *ngSwitchCase="'date'" class="flex items-center gap-2">
              <input
                type="date"
                [(ngModel)]="draftText"
                [attr.min]="dateInputMin"
                (keydown.enter)="submitText()"
                class="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold text-eventText-deep dark:text-white dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="button" (click)="submitText()" class="h-11 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0">Send</button>
            </div>

            <div *ngSwitchCase="'textarea'" class="flex flex-col gap-2">
              <textarea
                rows="3"
                [(ngModel)]="draftText"
                [placeholder]="currentStep.placeholder || ''"
                class="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-medium text-eventText-deep dark:text-white dark:bg-gray-700/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              ></textarea>
              <button type="button" (click)="submitText()" class="self-end h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0">Send</button>
            </div>

            <div *ngSwitchCase="'single'" class="flex flex-wrap gap-2">
              <button
                *ngFor="let opt of currentStep.options"
                type="button"
                (click)="submitSingle(opt)"
                class="h-9 px-4 rounded-full border border-slate-200 dark:border-gray-700 text-xs font-bold text-eventText-deep dark:text-white hover:border-primary hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
              >
                {{ opt }}
              </button>
            </div>

            <div *ngSwitchCase="'multi'" class="flex flex-col gap-2.5">
              <div class="flex flex-wrap gap-2">
                <button
                  *ngFor="let opt of currentStep.options"
                  type="button"
                  (click)="toggleMulti(opt)"
                  class="h-9 px-4 rounded-full border text-xs font-bold transition-colors"
                  [class.border-primary]="draftMultiSelected.has(opt)"
                  [class.bg-primary-50]="draftMultiSelected.has(opt)"
                  [class.dark:bg-primary/10]="draftMultiSelected.has(opt)"
                  [class.text-primary]="draftMultiSelected.has(opt)"
                  [class.border-slate-200]="!draftMultiSelected.has(opt)"
                  [class.dark:border-gray-700]="!draftMultiSelected.has(opt)"
                  [class.text-eventText-deep]="!draftMultiSelected.has(opt)"
                  [class.dark:text-white]="!draftMultiSelected.has(opt)"
                >
                  {{ opt }}
                </button>
              </div>
              <button
                type="button"
                (click)="submitMulti()"
                class="self-end h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0"
              >
                Continue{{ draftMultiSelected.size ? ' (' + draftMultiSelected.size + ' selected)' : '' }}
              </button>
            </div>

            <div *ngSwitchCase="'image'" class="flex flex-wrap items-center gap-2">
              <input #coverInput type="file" accept="image/jpeg,image/png" class="hidden" (change)="onCoverFileSelected($event)" />
              <button
                type="button"
                (click)="coverInput.click()"
                class="h-9 px-4 rounded-full border border-slate-200 dark:border-gray-700 text-xs font-bold text-eventText-deep dark:text-white hover:border-primary hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
              >
                Upload Image
              </button>
              <button
                type="button"
                (click)="skipCoverImage()"
                class="h-9 px-4 rounded-full border border-slate-200 dark:border-gray-700 text-xs font-bold text-eventText-deep dark:text-white hover:border-primary hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
              >
                Skip
              </button>
            </div>
          </ng-container>

          <p *ngIf="validationError" class="text-[11px] font-bold text-red-500">{{ validationError }}</p>
        </div>

        <!-- Review screen -->
        <div *ngIf="reviewMode" class="px-6 sm:px-8 py-6 flex flex-col gap-5">
          <div>
            <h2 class="font-manrope text-lg font-black text-eventText-deep dark:text-white mb-1">
              Review your event details before publishing.
            </h2>
            <p class="text-xs font-semibold text-eventText-soft">Everything below comes straight from the conversation.</p>
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden grid grid-cols-1 sm:grid-cols-2">
            <div
              *ngFor="let row of reviewRows"
              class="px-4 py-3 border-b border-slate-100 dark:border-gray-700 sm:odd:border-r sm:odd:border-slate-100 sm:odd:dark:border-gray-700"
            >
              <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-0.5">{{ row.label }}</p>
              <p class="text-sm font-bold text-eventText-deep dark:text-white break-words whitespace-pre-line">{{ row.value || '—' }}</p>
            </div>
          </div>

          <div *ngIf="coverImageUrl">
            <p class="text-[10px] font-extrabold text-eventText-soft uppercase tracking-wide mb-1.5">Cover Image</p>
            <div
              class="h-32 w-full max-w-xs rounded-xl bg-cover bg-center border border-slate-200 dark:border-gray-700"
              [style.background-image]="'url(' + coverImageUrl + ')'"
            ></div>
          </div>
        </div>

        <!-- Footer -->
        <div *ngIf="reviewMode" class="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-gray-700 flex flex-wrap items-center gap-3">
          <button
            type="button"
            (click)="editDetails()"
            class="h-10 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-gray-700 text-eventText-mid dark:text-gray-300 hover:border-slate-300 transition-colors"
          >
            Edit Details
          </button>
          <div class="flex-1"></div>
          <button
            type="button"
            (click)="saveDraft()"
            class="h-10 px-4 rounded-xl text-xs font-bold border border-primary text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
          >
            Save as Draft
          </button>
          <button
            type="button"
            (click)="publish()"
            [disabled]="publishing"
            class="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ publishing ? 'Publishing…' : 'Publish Event' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reusable bubble templates -->
    <ng-template #botBubble let-text="text">
      <div class="flex items-start gap-2.5">
        <span class="w-7 h-7 rounded-full bg-primary-50 dark:bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4L12 2Z" />
            <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
          </svg>
        </span>
        <div class="max-w-[80%] bg-slate-50 dark:bg-gray-700/60 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm font-semibold text-eventText-deep dark:text-white whitespace-pre-line">
          {{ text }}
        </div>
      </div>
    </ng-template>

    <ng-template #userBubble let-entry="entry">
      <div class="flex items-start justify-end gap-2 group">
        <button
          type="button"
          (click)="editAnswer(entry)"
          class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center text-eventText-soft hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 shrink-0 mt-1"
          aria-label="Edit this answer"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <div class="max-w-[80%] bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-bold whitespace-pre-line">
          {{ entry.answerText }}
        </div>
      </div>
    </ng-template>

    <!-- Toast -->
    <div *ngIf="toastMessage" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
      {{ toastMessage }}
    </div>
  `
})
export class CommunityHostEventComponent {
  private readonly store = inject(CommunityEventsMockStore);
  private readonly router = inject(Router);

  @ViewChild('transcript') private transcriptRef?: ElementRef<HTMLDivElement>;

  readonly STEPS = STEPS;
  readonly todayIso = toLocalIsoDate(new Date());

  answers: Answers = defaultAnswers();
  history: HistoryEntry[] = [];
  currentStep: StepDef | null = null;
  currentStepIndex = 0;

  /** String for most kinds; Angular's NumberValueAccessor rebinds this to a number for type="number" inputs. */
  draftText: string | number = '';
  draftMultiSelected = new Set<string>();
  validationError: string | null = null;
  botTyping = false;

  reviewMode = false;
  editingHint = false;
  publishing = false;

  coverImageUrl: string | null = null;

  showResumePrompt = false;
  private pendingDraft: { answers: Answers; coverImageUrl: string | null } | null = null;

  toastMessage: string | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const draft = this.tryLoadDraft();
    if (draft) {
      this.pendingDraft = draft;
      this.showResumePrompt = true;
    } else {
      this.goToStep(0);
    }
  }

  get totalVisibleSteps(): number {
    return this.STEPS.filter((s) => !s.visible || s.visible(this.answers)).length;
  }

  get currentQuestionNumber(): number {
    return Math.min(this.history.length + 1, this.totalVisibleSteps);
  }

  get progressPercent(): number {
    const total = this.totalVisibleSteps || 1;
    return Math.min(100, Math.round((this.history.length / total) * 100));
  }

  get dateInputMin(): string {
    if (!this.currentStep) return this.todayIso;
    if (this.currentStep.key === 'endDate') return this.answers.startDate || this.todayIso;
    return this.todayIso;
  }

  get reviewRows(): ReviewRow[] {
    const a = this.answers;
    return [
      { label: 'Destination', value: a.destination.trim() },
      { label: 'Start Location', value: a.startLocation.trim() },
      { label: 'End Location', value: a.differentEnd === 'Yes' ? a.endLocation.trim() : 'Same as start location' },
      { label: 'Start Date', value: this.formatDateDisplay(a.startDate) },
      { label: 'End Date', value: this.formatDateDisplay(a.endDate) },
      { label: 'Trip Type', value: a.tripType },
      { label: 'Travel Style', value: a.travelStyle.join(', ') },
      { label: 'Transportation Preferences', value: a.transportation.join(', ') },
      { label: 'Journey Name', value: a.journeyName.trim() },
      { label: 'Description', value: a.description.trim() },
      { label: 'Minimum Travelers', value: a.minTravelers },
      { label: 'Maximum Travelers', value: a.maxTravelers },
      { label: 'Minimum Stay Rule', value: a.minimumStay },
      { label: 'Partial Participation', value: a.partialParticipation },
      { label: 'Cover Image', value: this.coverImageUrl ? 'Uploaded' : 'None' }
    ];
  }

  // ── Step navigation ──────────────────────────────────────────────

  private goToStep(index: number): void {
    let i = index;
    while (i < this.STEPS.length) {
      const step = this.STEPS[i];
      if (!step.visible || step.visible(this.answers)) {
        this.currentStepIndex = i;
        this.currentStep = step;
        this.prefillDraft(step);
        this.scrollSoon();
        return;
      }
      i++;
    }
    this.currentStep = null;
    this.currentStepIndex = this.STEPS.length;
    this.reviewMode = true;
    this.editingHint = false;
  }

  private prefillDraft(step: StepDef): void {
    this.validationError = null;
    const value = this.answers[step.key];
    if (step.kind === 'multi') {
      this.draftMultiSelected = new Set(Array.isArray(value) ? value : []);
    } else {
      this.draftText = typeof value === 'string' ? value : '';
    }
  }

  // ── Answer formatting ────────────────────────────────────────────

  private formatDateDisplay(iso: string): string {
    if (!iso) return '';
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private formatAnswer(step: StepDef, value: string | string[]): string {
    if (step.kind === 'multi') return (value as string[]).join(', ');
    if (step.kind === 'date') return this.formatDateDisplay(value as string);
    if (step.kind === 'image') return value === 'Upload Image' ? 'Uploaded a cover photo ✓' : 'Skipped — no cover image';
    return String(value);
  }

  private noteFor(step: StepDef, value: string | string[]): string | undefined {
    if (step.key === 'smartDates' && value === 'Yes, suggest dates') {
      const dest = this.answers.destination.trim() || 'your destination';
      const start = this.answers.startDate ? this.formatDateDisplay(this.answers.startDate) : '';
      const end = this.answers.endDate ? this.formatDateDisplay(this.answers.endDate) : '';
      const window = start && end ? `${start} – ${end}` : 'your selected dates';
      return `Based on typical weather, local events, and pricing for ${dest}, ${window} looks like a solid window — I'll keep your dates as is. You can always come back and adjust them.`;
    }
    return undefined;
  }

  // ── Committing an answer ─────────────────────────────────────────

  private commitAnswer(step: StepDef, value: string | string[]): void {
    (this.answers as unknown as Record<AnswerKey, string | string[]>)[step.key] = value;

    this.history.push({
      index: this.currentStepIndex,
      key: step.key,
      prompt: step.prompt,
      answerText: this.formatAnswer(step, value),
      note: this.noteFor(step, value)
    });

    this.currentStep = null;
    this.validationError = null;
    this.scrollSoon();
    this.botTyping = true;

    setTimeout(() => {
      this.botTyping = false;
      this.goToStep(this.currentStepIndex + 1);
    }, 380);
  }

  submitText(): void {
    const step = this.currentStep;
    if (!step) return;
    // Angular's NumberValueAccessor binds a numeric value (not a string) to
    // ngModel for type="number" inputs, so this must be coerced before trim().
    const trimmed = String(this.draftText ?? '').trim();

    if (!trimmed) {
      this.validationError = "This one's required.";
      return;
    }

    if (step.key === 'endDate' && this.answers.startDate) {
      if (new Date(trimmed).getTime() < new Date(this.answers.startDate).getTime()) {
        this.validationError = 'End date should be on or after the start date.';
        return;
      }
    }

    if (step.key === 'minTravelers' || step.key === 'maxTravelers') {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 1) {
        this.validationError = 'Enter a number of 1 or more.';
        return;
      }
      if (step.key === 'maxTravelers') {
        const min = Number(this.answers.minTravelers) || 1;
        if (n < min) {
          this.validationError = `Must be at least ${min} (your minimum).`;
          return;
        }
      }
    }

    this.commitAnswer(step, trimmed);
  }

  submitSingle(option: string): void {
    const step = this.currentStep;
    if (!step) return;
    this.commitAnswer(step, option);
  }

  toggleMulti(option: string): void {
    if (this.draftMultiSelected.has(option)) {
      this.draftMultiSelected.delete(option);
    } else {
      this.draftMultiSelected.add(option);
    }
  }

  submitMulti(): void {
    const step = this.currentStep;
    if (!step) return;
    if (this.draftMultiSelected.size === 0) {
      this.validationError = 'Pick at least one option.';
      return;
    }
    this.commitAnswer(step, [...this.draftMultiSelected]);
  }

  onCoverFileSelected(event: Event): void {
    const step = this.currentStep;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !step) return;
    if (this.coverImageUrl) URL.revokeObjectURL(this.coverImageUrl);
    this.coverImageUrl = URL.createObjectURL(file);
    this.commitAnswer(step, 'Upload Image');
  }

  skipCoverImage(): void {
    const step = this.currentStep;
    if (!step) return;
    if (this.coverImageUrl) {
      URL.revokeObjectURL(this.coverImageUrl);
      this.coverImageUrl = null;
    }
    this.commitAnswer(step, 'Skip');
  }

  // ── Editing previous answers ─────────────────────────────────────

  editAnswer(entry: HistoryEntry): void {
    this.reviewMode = false;
    this.editingHint = false;
    const cutIndex = this.history.indexOf(entry);
    if (cutIndex === -1) return;
    this.history = this.history.slice(0, cutIndex);
    this.botTyping = false;
    this.goToStep(entry.index);
  }

  editDetails(): void {
    this.reviewMode = false;
    this.editingHint = true;
  }

  backToReview(): void {
    this.editingHint = false;
    this.reviewMode = true;
  }

  // ── Draft persistence (local only, no backend) ───────────────────

  private tryLoadDraft(): { answers: Answers; coverImageUrl: string | null } | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.answers) return null;
      return { answers: { ...defaultAnswers(), ...parsed.answers }, coverImageUrl: parsed.coverImageUrl ?? null };
    } catch {
      return null;
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* best-effort local persistence only */
    }
  }

  resumeDraft(): void {
    if (!this.pendingDraft) return;
    this.answers = this.pendingDraft.answers;
    this.coverImageUrl = this.pendingDraft.coverImageUrl;
    this.showResumePrompt = false;
    this.rebuildHistoryFromAnswers();
  }

  discardDraft(): void {
    this.clearDraft();
    this.pendingDraft = null;
    this.showResumePrompt = false;
    this.answers = defaultAnswers();
    this.goToStep(0);
  }

  private rebuildHistoryFromAnswers(): void {
    this.history = [];
    let i = 0;
    while (i < this.STEPS.length) {
      const step = this.STEPS[i];
      if (step.visible && !step.visible(this.answers)) {
        i++;
        continue;
      }
      const value = this.answers[step.key];
      const hasValue = step.kind === 'multi' ? Array.isArray(value) && value.length > 0 : !!value;
      if (!hasValue) break;
      this.history.push({
        index: i,
        key: step.key,
        prompt: step.prompt,
        answerText: this.formatAnswer(step, value),
        note: this.noteFor(step, value)
      });
      i++;
    }
    this.goToStep(i);
  }

  saveDraft(): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: this.answers, coverImageUrl: this.coverImageUrl }));
      this.showToast("Saved as draft — pick up where you left off anytime from 'Host an event'.");
    } catch {
      this.showToast('Could not save the draft on this device.');
    }
  }

  // ── Publish ───────────────────────────────────────────────────────

  private tripDurationLabel(): string {
    if (!this.answers.startDate || !this.answers.endDate) return '';
    const start = new Date(`${this.answers.startDate}T00:00:00`);
    const end = new Date(`${this.answers.endDate}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return days === 1 ? '1 day' : `${days} days`;
  }

  private buildEventCard(): CommunityEventCard {
    const a = this.answers;
    const start = a.startDate ? new Date(`${a.startDate}T00:00:00`) : new Date();
    const routeNote =
      a.differentEnd === 'Yes' && a.endLocation.trim()
        ? `Route: ${a.startLocation.trim()} → ${a.endLocation.trim()}`
        : `Starts from: ${a.startLocation.trim()}`;

    const descriptionParts = [
      a.description.trim(),
      a.tripType ? `Trip type: ${a.tripType}` : '',
      a.travelStyle.length ? `Travel style: ${a.travelStyle.join(', ')}` : '',
      a.transportation.length ? `Transportation: ${a.transportation.join(', ')}` : '',
      routeNote,
      a.minimumStay ? `Minimum stay: ${a.minimumStay}` : '',
      a.partialParticipation ? `Partial participation: ${a.partialParticipation}` : ''
    ].filter(Boolean);

    return {
      id: `evt-${Date.now()}`,
      title: a.journeyName.trim(),
      location: a.destination.trim(),
      time: '',
      duration: this.tripDurationLabel(),
      price: 'Free',
      travelersGoing: 0,
      month: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: start.getDate().toString().padStart(2, '0'),
      tag: 'Meetup',
      joined: false,
      followed: false,
      imageUrl: this.coverImageUrl || unsplashUrl('1488646953014-85cb44e25828'),
      hostId: CURRENT_USER_ID,
      hostName: 'You',
      hostRole: '',
      reason: '',
      description: descriptionParts.join('\n'),
      groupMax: a.maxTravelers ? `${a.maxTravelers} max` : '',
      schedule: [],
      locationName: a.startLocation.trim() || a.destination.trim(),
      locationNote: `Min travelers: ${a.minTravelers || '—'} · Max travelers: ${a.maxTravelers || '—'}`
    };
  }

  publish(): void {
    if (this.publishing) return;
    this.publishing = true;

    const card = this.buildEventCard();
    this.store.addEvent(card);
    this.store.setPendingToast(`"${card.title}" is live — visible to the community`);
    this.clearDraft();
    this.publishing = false;
    this.router.navigateByUrl('/community/events');
  }

  // ── Misc ────────────────────────────────────────────────────────

  private scrollSoon(): void {
    setTimeout(() => {
      const el = this.transcriptRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = null), 3000);
  }
}
