import { Component, EventEmitter, Output, Input, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityPostService, CommunityPost } from '../services/community-post.service';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { apiUrl } from '../../shared/utils/api-url';
import { DestinationSearchService } from '../../shared/services/destination-search.service';
import { DestinationListItem } from '../../shared/utils/destination.util';
import { apiErrorMessage } from '../../shared/utils/api-error.util';

interface DestinationOption {
  id: string;
  name: string;
  country: string;
  image: string;
}

@Component({
    selector: 'app-community-create-post',
    imports: [CommonModule, TranslatePipe],
    template: `
    <div class="w-full bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/80 dark:border-gray-700/80 transition-all duration-300">
      <!-- Post type chips -->
      <div class="flex gap-2 px-4 pt-3 pb-0 overflow-x-auto no-scrollbar">
        @for (type of postTypes; track type.value) {
          <button
            type="button"
            (click)="setPostType(type.value)"
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs-plus font-bold border transition-all focus:outline-none"
            [ngClass]="selectedPostType === type.value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-200 dark:border-gray-700'"
          >
            <span>{{ type.emoji }}</span> {{ type.label }}
          </button>
        }
      </div>
      <div class="p-4 flex gap-3.5">
        <!-- Avatar -->
        <img [src]="userAvatar || '/assets/images/default-avatar.svg'" [attr.alt]="'COMMUNITY.AVATAR_ALT' | translate" class="w-11 h-11 rounded-full object-cover bg-slate-50 dark:bg-gray-700 border border-slate-100 dark:border-gray-700 shadow-sm shrink-0" />

        <div class="flex-1 space-y-4">
          <!-- Caption -->
          <div class="relative">
            <textarea
              #captionInput
            (focus)="expandForm()"
            [attr.placeholder]="getPlaceholder()"
              class="w-full px-4 py-3 bg-slate-50/60 dark:bg-gray-900/40 border border-slate-200/60 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-gray-900/60 transition-all resize-none text-text-primary placeholder-text-disabled text-sm font-medium"
              [class.h-11]="!isExpanded"
              [class.h-28]="isExpanded"
              maxlength="2000"
            ></textarea>
            @if (isExpanded) {
              <div class="absolute bottom-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-gray-800/80 backdrop-blur border border-slate-100 dark:border-gray-700 shadow-sm text-text-tertiary select-none">
                {{ captionInput.value.length }}/2000
              </div>
            }
          </div>

          @if (isExpanded) {
            <div class="space-y-4 animate-fade-in-up">
              <!-- Media Previews -->
              @if (previewImages.length > 0 || videoPreviewUrl) {
                <div class="space-y-4">
                  <!-- Image Previews -->
                  @if (previewImages.length > 0) {
                    <div class="grid grid-cols-3 gap-3">
                      @for (image of previewImages; track image.url; let i = $index) {
                        <div class="relative aspect-square group/item rounded-xl overflow-hidden shadow-sm border border-slate-200/50">
                          <img [src]="image.url" [attr.alt]="'COMMUNITY.CREATE_POST.PREVIEW_ALT' | translate" class="w-full h-full object-cover transition-transform duration-300 group-hover/item:scale-105" loading="lazy" decoding="async" />
                          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              (click)="removeImage($event, i)"
                              class="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 focus:outline-none transform hover:scale-110 transition-transform shadow-md"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }

                  <!-- Video Preview -->
                  @if (videoPreviewUrl) {
                    <div class="relative group rounded-xl overflow-hidden shadow-sm bg-black border border-slate-200/50 max-w-sm mx-auto">
                      <video [src]="videoPreviewUrl" controls class="w-full max-h-60"></video>
                      <button
                        type="button"
                        (click)="removeVideo()"
                        class="absolute top-2.5 right-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 focus:outline-none transform hover:scale-110 transition-all shadow-md"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p class="text-2xs font-extrabold text-text-tertiary mt-1.5 uppercase tracking-wider text-center">{{ 'COMMUNITY.CREATE_POST.REEL_NOTICE' | translate }}</p>
                  }
                </div>
              }

              <!-- Hidden File Inputs -->
              <input
                #fileInput
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                (change)="onImageSelect($event)"
              />
              <input
                #videoInput
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                class="hidden"
                (change)="onVideoSelect($event)"
              />

              <!-- Location/Destination -->
              @if (showLocationInput || showTripInput) {
                <div class="grid grid-cols-1 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  @if (showLocationInput) {
                    <div class="space-y-2">
                      <label class="block text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.CREATE_POST.TAG_DESTINATION' | translate }}</label>
                      <div class="relative">
                        <input
                          #destinationInput
                          type="text"
                          role="combobox"
                          aria-autocomplete="list"
                          [attr.aria-expanded]="showDestinationsDropdown && destinationOptions.length > 0"
                          aria-controls="community-destination-listbox"
                          [attr.aria-activedescendant]="activeDestinationIndex >= 0 ? 'community-dest-option-' + activeDestinationIndex : null"
                          [attr.placeholder]="'COMMUNITY.CREATE_POST.SEARCH_DESTINATIONS' | translate"
                          class="w-full px-4 py-2.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-semibold text-text-primary shadow-sm"
                          (input)="onDestinationSearch($event)"
                          (keydown)="onDestinationKeydown($event)"
                          [value]="selectedDestination?.name || destinationQuery"
                        />
                        @if (showDestinationsDropdown && destinationOptions.length > 0) {
                          <ul
                            id="community-destination-listbox"
                            class="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] max-h-60 overflow-auto divide-y divide-slate-50 dark:divide-gray-700"
                            role="listbox"
                            [attr.aria-label]="'COMMUNITY.CREATE_POST.SEARCH_DESTINATIONS' | translate"
                          >
                            @for (dest of destinationOptions; track dest.id; let i = $index) {
                              <li>
                                <button
                                  type="button"
                                  [id]="'community-dest-option-' + i"
                                  class="w-full px-4 py-3 hover:bg-primary-50/50 cursor-pointer flex items-center gap-3 transition-colors text-left"
                                  [class.bg-primary-50]="activeDestinationIndex === i"
                                  role="option"
                                  [attr.aria-selected]="activeDestinationIndex === i"
                                  (mousedown)="$event.preventDefault()"
                                  (click)="selectDestination(dest)"
                                >
                                  <img [src]="dest.image || 'assets/images/placeholder.jpg'" class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0 border border-slate-100" alt="" loading="lazy" decoding="async" />
                                  <div>
                                    <p class="text-xs font-bold text-text-primary">{{ dest.name }}</p>
                                    <p class="text-[9px] font-extrabold text-text-tertiary uppercase tracking-wider">{{ dest.country }}</p>
                                  </div>
                                </button>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    </div>
                  }

                  @if (showTripInput) {
                    <div class="space-y-2">
                      <label class="block text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.CREATE_POST.ATTACH_ITINERARY' | translate }}</label>
                      <div class="relative">
                        <select
                          (change)="onTripSelect($event)"
                          class="w-full px-4 py-2.5 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-semibold text-text-primary appearance-none cursor-pointer shadow-sm"
                        >
                          <option value="">{{ 'COMMUNITY.CREATE_POST.NO_ITINERARY' | translate }}</option>
                          @for (trip of trips; track trip.id) {
                            <option [value]="trip.id">{{ trip.title }} ({{ trip.destination }})</option>
                          }
                        </select>
                        <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-text-tertiary">
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Soundscape Selector Dropdown -->
              @if (showSoundscapeDropdown) {
                <div class="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-2 animate-fade-in-up">
                  <label class="block text-2xs font-extrabold text-text-tertiary uppercase tracking-wider">{{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_LABEL' | translate }}</label>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button type="button" (click)="selectSoundscape('none')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center" [class]="selectedSoundscape === 'none' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">{{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_NONE' | translate }}</button>
                    <button type="button" (click)="selectSoundscape('kyoto_rain')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5" [class]="selectedSoundscape === 'kyoto_rain' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">🌧️ {{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_KYOTO_RAIN' | translate }}</button>
                    <button type="button" (click)="selectSoundscape('bali_beach')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5" [class]="selectedSoundscape === 'bali_beach' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">🌊 {{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_BALI_BEACH' | translate }}</button>
                    <button type="button" (click)="selectSoundscape('paris_cafe')" class="px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5" [class]="selectedSoundscape === 'paris_cafe' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white dark:bg-gray-800 text-text-secondary border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'">☕ {{ 'COMMUNITY.CREATE_POST.SOUNDSCAPE_PARIS_CAFE' | translate }}</button>
                  </div>
                </div>
              }

              <!-- Soundwave Visualizer -->
              @if (selectedSoundscape !== 'none') {
                <div class="flex items-center justify-center gap-1 h-8 bg-slate-50 rounded-lg border border-slate-100 px-4">
                  @for (i of [1,2,3,4,5,6,7,8,9,10,11,12]; track i) {
                    <div class="w-1 bg-primary/40 rounded-full animate-[soundwave_1s_ease-in-out_infinite]" [style.animation-delay]="(i * 0.1) + 's'"></div>
                  }
                </div>
              }

              <!-- Action Toolbar -->
              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center gap-1.5 text-primary">
                  <button type="button" (click)="fileInput.click()" class="p-2 hover:bg-primary-50 rounded-full transition-colors focus:outline-none" [title]="'COMMUNITY.CREATE_POST.ATTACH_PHOTOS_TITLE' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_PHOTOS_TITLE' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button type="button" (click)="videoInput.click()" class="p-2 hover:bg-primary-50 rounded-full transition-colors focus:outline-none" [title]="'COMMUNITY.CREATE_POST.ATTACH_VIDEO_TITLE' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_VIDEO_TITLE' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button type="button" (click)="showLocationInput = !showLocationInput" class="p-2 rounded-full transition-colors focus:outline-none" [class]="showLocationInput ? 'bg-primary-50 text-primary' : 'hover:bg-primary-50'" [title]="'COMMUNITY.CREATE_POST.TAG_DESTINATION' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.TAG_DESTINATION' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button type="button" (click)="showTripInput = !showTripInput" class="p-2 rounded-full transition-colors focus:outline-none" [class]="showTripInput ? 'bg-primary-50 text-primary' : 'hover:bg-primary-50'" [title]="'COMMUNITY.CREATE_POST.ATTACH_ITINERARY' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_ITINERARY' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </button>
                  <button type="button" (click)="toggleSoundscapeDropdown()" class="p-2 rounded-full transition-colors focus:outline-none" [class]="selectedSoundscape !== 'none' ? 'bg-primary-50 text-primary' : 'hover:bg-primary-50'" [title]="'COMMUNITY.CREATE_POST.ATTACH_SOUNDSCAPE_TITLE' | translate" [attr.aria-label]="'COMMUNITY.CREATE_POST.ATTACH_SOUNDSCAPE_TITLE' | translate">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </button>
                </div>
                
                <div class="flex items-center gap-2">
                  <button
                    (click)="collapseForm()"
                    class="px-4 py-1.5 text-xs text-text-secondary hover:bg-slate-100 rounded-full font-bold transition-all focus:outline-none"
                  >
                    {{ 'COMMUNITY.CREATE_POST.CANCEL' | translate }}
                  </button>
                  <button
                    (click)="submitPost(captionInput.value, '')"
                    [disabled]="!captionInput.value.trim() || isLoading"
                    class="px-6 py-1.5 text-xs bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white rounded-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    @if (isLoading) {
                      <svg class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    }
                    {{ isLoading ? ('COMMUNITY.CREATE_POST.POSTING' | translate) : ('COMMUNITY.CREATE_POST.POST' | translate) }}
                  </button>
                </div>
              </div>

              @if (error) {
                <div class="bg-danger-50 border border-red-200 text-danger px-3 py-2.5 rounded-xl text-xs font-semibold shadow-sm animate-fade-in-up">
                  {{ error }}
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes soundwave {
      0% { height: 3px; }
      100% { height: 12px; }
    }
  `]
})
export class CommunityCreatePostComponent implements OnInit, OnDestroy {
  @Input() userAvatar?: string;
  @Output() postCreated = new EventEmitter<CommunityPost>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('captionInput') captionInputRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('destinationInput') destinationInputRef?: ElementRef<HTMLInputElement>;

  private readonly destinationSearch = inject(DestinationSearchService);

  postTypes = [
    { value: 'photo', label: 'Photo', emoji: '📸' },
    { value: 'trip_share', label: 'Trip Share', emoji: '✈️' },
    { value: 'question', label: 'Question', emoji: '🤔' },
    { value: 'buddy_request', label: 'Find Buddy', emoji: '🤝' },
    { value: 'poll', label: 'Poll', emoji: '📊' },
    { value: 'qa', label: 'Q&A Thread', emoji: '💬' },
  ];
  selectedPostType = 'photo';

  isExpanded = false;
  showLocationInput = false;
  showTripInput = false;
  selectedSoundscape = 'none';
  showSoundscapeDropdown = false;

  previewImages: { file: File, url: string }[] = [];
  videoFile: File | null = null;
  videoPreviewUrl: string | null = null;
  isLoading = false;
  error: string | null = null;
  
  destinationOptions: DestinationOption[] = [];
  selectedDestination: DestinationOption | null = null;
  destinationQuery = '';
  showDestinationsDropdown = false;
  activeDestinationIndex = -1;
  private searchSubject = new Subject<string>();
  private searchSubscription = this.searchSubject
    .pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        if (!query) return of<DestinationListItem[]>([]);
        return this.destinationSearch.search(query, 5);
      }),
    )
    .subscribe((rows) => {
      this.destinationOptions = rows.map((item) => this.toDestinationOption(item));
      this.showDestinationsDropdown = this.destinationOptions.length > 0;
      this.activeDestinationIndex = -1;
    });

  trips: any[] = [];
  selectedTripId: string | null = null;

  constructor(
    private postService: CommunityPostService,
    private http: HttpClient,
    private translate: TranslateService
  ) {}

  setPostType(type: string) {
    this.selectedPostType = type;
    if (type === 'buddy_request') {
      this.showLocationInput = true;
      this.expandForm();
    } else if (type === 'trip_share') {
      this.showTripInput = true;
      this.expandForm();
    }
  }

  getPlaceholder(): string {
    switch (this.selectedPostType) {
      case 'trip_share': return 'Share your trip story…';
      case 'question': return 'Ask the community…';
      case 'buddy_request': return 'Looking for a travel buddy? Describe your trip plans…';
      default: return this.translate.instant('COMMUNITY.CREATE_POST.CAPTION_PLACEHOLDER');
    }
  }

  ngOnInit() {
    this.destinationSearch.load();

    this.http.get<any>(apiUrl('/trips')).subscribe({
      next: (res) => {
        this.trips = res.items || [];
      },
      error: (err) => console.error('Failed to load trips', err)
    });
  }

  onTripSelect(event: Event) {
    this.selectedTripId = (event.target as HTMLSelectElement).value || null;
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  onDestinationSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value.trim();
    this.destinationQuery = (event.target as HTMLInputElement).value;
    
    // Allow clearing
    if (!query) {
      this.selectedDestination = null;
      this.showDestinationsDropdown = false;
      this.activeDestinationIndex = -1;
      this.searchSubject.next('');
      return;
    }

    if (this.selectedDestination && query !== this.selectedDestination.name) {
      this.selectedDestination = null;
    }

    this.searchSubject.next(query);
  }

  onDestinationKeydown(event: KeyboardEvent): void {
    if (!this.showDestinationsDropdown || !this.destinationOptions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeDestinationIndex = (this.activeDestinationIndex + 1) % this.destinationOptions.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeDestinationIndex =
        this.activeDestinationIndex <= 0
          ? this.destinationOptions.length - 1
          : this.activeDestinationIndex - 1;
      return;
    }
    if (event.key === 'Enter' && this.activeDestinationIndex >= 0) {
      event.preventDefault();
      this.selectDestination(this.destinationOptions[this.activeDestinationIndex]!);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.showDestinationsDropdown = false;
      this.activeDestinationIndex = -1;
    }
  }

  selectDestination(dest: DestinationOption) {
    this.selectedDestination = dest;
    this.destinationQuery = dest.name;
    this.showDestinationsDropdown = false;
    this.activeDestinationIndex = -1;
    if (this.destinationInputRef) {
      this.destinationInputRef.nativeElement.value = dest.name;
    }
  }

  private toDestinationOption(item: DestinationListItem): DestinationOption {
    return {
      id: item.id ?? item.name,
      name: item.name,
      country:
        item.country ||
        item.region ||
        this.translate.instant('COMMUNITY.CREATE_POST.UNKNOWN_COUNTRY'),
      image: item.image || '',
    };
  }

  onImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach(file => {
        this.previewImages.push({
          file,
          url: URL.createObjectURL(file)
        });
      });
    }
  }

  removeImage(event: Event, index: number) {
    event.stopPropagation();
    const item = this.previewImages[index];
    if (item) {
      URL.revokeObjectURL(item.url);
      this.previewImages.splice(index, 1);
    }
  }

  onVideoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      this.error = this.translate.instant('COMMUNITY.CREATE_POST.VIDEO_TOO_LARGE');
      return;
    }
    if (this.videoPreviewUrl) URL.revokeObjectURL(this.videoPreviewUrl);
    this.videoFile = file;
    this.videoPreviewUrl = URL.createObjectURL(file);
    this.error = null;
  }

  removeVideo() {
    if (this.videoPreviewUrl) URL.revokeObjectURL(this.videoPreviewUrl);
    this.videoFile = null;
    this.videoPreviewUrl = null;
  }

  submitPost(caption: string, location: string) {
    if (!caption.trim()) {
      this.error = this.translate.instant('COMMUNITY.CREATE_POST.CAPTION_REQUIRED');
      return;
    }

    this.isLoading = true;
    this.error = null;

    const imageUploads = this.previewImages.map(img =>
      this.postService.uploadImage(img.file).pipe(
        catchError(err => {
          console.error('Upload failed for file', img.file.name, err);
          throw err;
        })
      )
    );
    const videoUpload = this.videoFile ? this.postService.uploadImage(this.videoFile) : of(null);

    // Object form avoids forkJoin([]) never-emitting when there are no images.
    forkJoin({
      images: imageUploads.length ? forkJoin(imageUploads) : of([] as { url: string }[]),
      video: videoUpload
    }).subscribe({
      next: ({ images, video }) => {
        const imageUrls = (images as { url: string }[]).map(res => res.url);
        const videoUrl = video ? (video as { url: string }).url : undefined;

        let finalCaption = caption.trim();
        if (this.selectedSoundscape !== 'none') {
          finalCaption = finalCaption + ' [soundscape:' + this.selectedSoundscape + ']';
        }

        this.postService.createPost({
          caption: finalCaption,
          location: location.trim() || undefined,
          destination_id: this.selectedDestination?.id,
          images: imageUrls,
          itinerary_id: this.selectedTripId || undefined,
          video_url: videoUrl,
          is_reel: !!videoUrl
        }).subscribe({
          next: (post) => {
            this.postCreated.emit(post);
            this.closeModal();
          },
          error: (err) => {
            console.error('Failed to create post:', err);
            this.error = apiErrorMessage(err, this.translate.instant('COMMUNITY.CREATE_POST.CREATE_FAILED'));
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        this.error = this.translate.instant('COMMUNITY.CREATE_POST.UPLOAD_FAILED');
        this.isLoading = false;
      }
    });
  }

  toggleSoundscapeDropdown() {
    this.showSoundscapeDropdown = !this.showSoundscapeDropdown;
  }

  selectSoundscape(type: string) {
    this.selectedSoundscape = type;
    this.showSoundscapeDropdown = false;
  }

  expandForm() {
    this.isExpanded = true;
  }

  collapseForm() {
    if (this.previewImages.length > 0 || this.videoFile || this.captionInputRef?.nativeElement.value) {
      if (!window.confirm(this.translate.instant('COMMUNITY.CREATE_POST.DISCARD_CONFIRM'))) {
        return;
      }
    }
    
    this.previewImages.forEach(img => URL.revokeObjectURL(img.url));
    if (this.videoPreviewUrl) URL.revokeObjectURL(this.videoPreviewUrl);
    
    this.previewImages = [];
    this.videoFile = null;
    this.videoPreviewUrl = null;
    if (this.captionInputRef) this.captionInputRef.nativeElement.value = '';
    this.selectedDestination = null;
    this.selectedTripId = null;
    this.destinationQuery = '';
    this.activeDestinationIndex = -1;
    
    this.showLocationInput = false;
    this.showTripInput = false;
    this.selectedSoundscape = 'none';
    this.showSoundscapeDropdown = false;
    this.isExpanded = false;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event) {
    if (this.showDestinationsDropdown) {
      this.showDestinationsDropdown = false;
      this.activeDestinationIndex = -1;
      return;
    }
    if (this.isExpanded) {
      this.collapseForm();
    }
  }

  closeModal() {
    this.collapseForm();
  }
}
