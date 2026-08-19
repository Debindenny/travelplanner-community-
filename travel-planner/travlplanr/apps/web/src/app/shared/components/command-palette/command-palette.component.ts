import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AuthService } from '../../../auth/auth.service';
import { TripService } from '../../../trip/trip.service';
import { CommandPaletteService } from '../../services/command-palette.service';
import { DestinationSearchService } from '../../services/destination-search.service';
import { TravelChatSessionService } from '../../services/travel-chat-session.service';
import { ChatContextService } from '../../services/chat-context.service';
import { DestinationListItem } from '../../utils/destination.util';
import { normalizeSearchText } from '../../services/destination-search.service';

type CommandGroup = 'destinations' | 'trips' | 'pages' | 'actions';

interface PaletteCommand {
  id: string;
  group: CommandGroup;
  label: string;
  subtitle?: string;
  icon: string;
  keywords?: string[];
}

interface PaletteResult extends PaletteCommand {
  score: number;
}

const PAGE_COMMANDS: PaletteCommand[] = [
  { id: 'page-home', group: 'pages', label: 'Home', icon: '🏠', keywords: ['landing', 'start'] },
  { id: 'page-explore', group: 'pages', label: 'Explore destinations', icon: '🌍', keywords: ['search', 'destinations', 'discover'] },
  { id: 'page-packages', group: 'pages', label: 'Packages', icon: '🧳', keywords: ['deals', 'tours'] },
  { id: 'page-trips', group: 'pages', label: 'My trips', icon: '✈️', keywords: ['itineraries', 'saved'] },
  { id: 'page-wizard', group: 'pages', label: 'Trip wizard', icon: '🪄', keywords: ['plan', 'create'] },
  { id: 'page-community', group: 'pages', label: 'Community', icon: '👥', keywords: ['social', 'posts'] },
  { id: 'page-blog', group: 'pages', label: 'Blog', icon: '📰', keywords: ['articles', 'guides'] },
  { id: 'page-faq', group: 'pages', label: 'FAQ', icon: '❓', keywords: ['help', 'support'] },
  { id: 'page-pricing', group: 'pages', label: 'Pricing', icon: '💳', keywords: ['plans', 'cost'] },
  { id: 'page-contact', group: 'pages', label: 'Contact', icon: '✉️', keywords: ['support', 'email'] },
];

const PAGE_ROUTES: Record<string, string> = {
  'page-home': '/',
  'page-explore': '/explore',
  'page-packages': '/packages',
  'page-trips': '/trips',
  'page-wizard': '/wizard',
  'page-community': '/community',
  'page-blog': '/blog',
  'page-faq': '/faq',
  'page-pricing': '/pricing',
  'page-contact': '/contact',
};

@Component({
    selector: 'app-command-palette',
    imports: [TranslatePipe],
    template: `
    @if (palette.open()) {
      <div class="palette-backdrop" (click)="close()" aria-hidden="true"></div>
      <div
        class="palette-panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'COMMAND_PALETTE.TITLE' | translate"
        (mousedown)="$event.stopPropagation()"
      >
        <div class="palette-search-wrap">
          <svg class="palette-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <input
            #queryInput
            type="text"
            enterkeyhint="search"
            class="palette-search-input"
            [placeholder]="'COMMAND_PALETTE.PLACEHOLDER' | translate"
            [attr.aria-label]="'COMMAND_PALETTE.PLACEHOLDER' | translate"
            [value]="query()"
            (input)="onQueryInput($event)"
            (keydown)="onInputKeydown($event)"
          />
          <kbd class="palette-kbd">esc</kbd>
        </div>

        <div class="palette-results" role="listbox" [attr.aria-label]="'COMMAND_PALETTE.RESULTS' | translate">
          @if (!query().trim()) {
            <p class="palette-hint">{{ 'COMMAND_PALETTE.HINT' | translate }}</p>
          } @else if (!results().length) {
            <p class="palette-empty">{{ 'COMMAND_PALETTE.NO_RESULTS' | translate }}</p>
          } @else {
            @for (group of groupedResults(); track group.key) {
              <p class="palette-group-label">{{ group.labelKey | translate }}</p>
              <ul class="palette-group-list">
                @for (item of group.items; track item.id; let i = $index) {
                  <li>
                    <button
                      type="button"
                      class="palette-item"
                      [class.active]="flatIndex(group.key, i) === activeIndex()"
                      role="option"
                      [attr.aria-selected]="flatIndex(group.key, i) === activeIndex()"
                      (mouseenter)="activeIndex.set(flatIndex(group.key, i))"
                      (click)="run(item)"
                    >
                      <span class="palette-item-icon" aria-hidden="true">{{ item.icon }}</span>
                      <span class="min-w-0 flex-1 text-left">
                        <span class="palette-item-label">{{ item.label }}</span>
                        @if (item.subtitle) {
                          <span class="palette-item-subtitle">{{ item.subtitle }}</span>
                        }
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }
          }
        </div>

        <div class="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> {{ 'COMMAND_PALETTE.NAVIGATE' | translate }}</span>
          <span><kbd>↵</kbd> {{ 'COMMAND_PALETTE.SELECT' | translate }}</span>
        </div>
      </div>
    }
  `,
    styles: [
        `
      .palette-backdrop {
        position: fixed;
        inset: 0;
        z-index: 11000;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(3px);
      }

      .palette-panel {
        position: fixed;
        top: 12vh;
        left: 50%;
        transform: translateX(-50%);
        z-index: 11001;
        width: min(640px, calc(100vw - 2rem));
        border-radius: 1.25rem;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: #fff;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }

      .palette-search-wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }

      .palette-search-icon {
        width: 1.1rem;
        height: 1.1rem;
        color: #94a3b8;
        flex-shrink: 0;
      }

      .palette-search-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 1rem;
        color: #0f172a;
        background: transparent;
        -webkit-appearance: none;
        appearance: none;
      }
      .palette-search-input::-webkit-search-decoration,
      .palette-search-input::-webkit-search-cancel-button {
        -webkit-appearance: none;
        display: none;
      }

      .palette-search-input::placeholder {
        color: #94a3b8;
      }

      .palette-kbd,
      .palette-footer kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.5rem;
        padding: 0.1rem 0.4rem;
        border-radius: 0.4rem;
        border: 1px solid rgba(15, 23, 42, 0.1);
        background: #f8fafc;
        font-size: 0.68rem;
        font-weight: 600;
        color: #64748b;
        text-transform: lowercase;
      }

      .palette-results {
        max-height: min(50vh, 420px);
        overflow: auto;
        padding: 0.5rem;
      }

      .palette-hint,
      .palette-empty {
        padding: 1.5rem 1rem;
        text-align: center;
        font-size: 0.875rem;
        color: #64748b;
      }

      .palette-group-label {
        margin: 0.5rem 0.75rem 0.35rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
      }

      .palette-group-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .palette-item {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 0.75rem;
        border: none;
        border-radius: 0.85rem;
        background: transparent;
        padding: 0.65rem 0.75rem;
        cursor: pointer;
        text-align: left;
        color: inherit;
      }

      .palette-item:hover,
      .palette-item.active {
        background: rgba(0, 96, 234, 0.08);
      }

      .palette-item-icon {
        width: 2rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.65rem;
        background: #f8fafc;
        flex-shrink: 0;
        font-size: 1rem;
      }

      .palette-item-label {
        display: block;
        font-size: 0.92rem;
        font-weight: 600;
        color: #0f172a;
      }

      .palette-item-subtitle {
        display: block;
        margin-top: 0.1rem;
        font-size: 0.75rem;
        color: #64748b;
      }

      .palette-footer {
        display: flex;
        gap: 1rem;
        padding: 0.7rem 1rem;
        border-top: 1px solid rgba(15, 23, 42, 0.08);
        font-size: 0.72rem;
        color: #94a3b8;
      }

      .palette-footer kbd + kbd {
        margin-left: 0.2rem;
      }
    `,
    ]
})
export class CommandPaletteComponent implements OnDestroy {
  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly trips = inject(TripService);
  private readonly destinationSearch = inject(DestinationSearchService);
  private readonly chat = inject(TravelChatSessionService);
  private readonly chatContext = inject(ChatContextService);

  readonly query = signal('');
  readonly activeIndex = signal(0);

  private readonly remoteDestinations = toSignal(
    toObservable(this.query).pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap((value) => {
        const trimmed = value.trim();
        if (trimmed.length < 2) return of<DestinationListItem[]>([]);
        return this.destinationSearch.search(trimmed, 6).pipe(catchError(() => of([])));
      }),
    ),
    { initialValue: [] as DestinationListItem[] },
  );

  readonly results = computed(() => this.buildResults(this.query(), this.remoteDestinations()));

  readonly groupedResults = computed(() => {
    const groups: { key: CommandGroup; labelKey: string; items: PaletteResult[] }[] = [];
    const byGroup = new Map<CommandGroup, PaletteResult[]>();
    for (const item of this.results()) {
      const bucket = byGroup.get(item.group) ?? [];
      bucket.push(item);
      byGroup.set(item.group, bucket);
    }
    const order: { key: CommandGroup; labelKey: string }[] = [
      { key: 'actions', labelKey: 'COMMAND_PALETTE.GROUP_ACTIONS' },
      { key: 'destinations', labelKey: 'COMMAND_PALETTE.GROUP_DESTINATIONS' },
      { key: 'trips', labelKey: 'COMMAND_PALETTE.GROUP_TRIPS' },
      { key: 'pages', labelKey: 'COMMAND_PALETTE.GROUP_PAGES' },
    ];
    for (const entry of order) {
      const items = byGroup.get(entry.key) ?? [];
      if (items.length) groups.push({ ...entry, items });
    }
    return groups;
  });

  constructor() {
    effect(() => {
      if (!this.palette.open()) return;
      this.query.set('');
      this.activeIndex.set(0);
      this.destinationSearch.load();
      queueMicrotask(() => this.queryInput()?.nativeElement.focus());
    }, { allowSignalWrites: true });

    effect(() => {
      this.results();
      this.activeIndex.set(0);
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void {
    this.palette.closePalette();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'k') {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      this.palette.toggle();
      return;
    }

    if (!this.palette.open()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const count = this.results().length;
      if (!count) return;
      this.activeIndex.update((index) => (index + 1) % count);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const count = this.results().length;
      if (!count) return;
      this.activeIndex.update((index) => (index <= 0 ? count - 1 : index - 1));
      return;
    }

    if (event.key === 'Enter') {
      const item = this.results()[this.activeIndex()];
      if (!item) return;
      event.preventDefault();
      this.run(item);
    }
  }

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
      event.preventDefault();
    }
  }

  flatIndex(group: CommandGroup, indexInGroup: number): number {
    let offset = 0;
    for (const entry of this.groupedResults()) {
      if (entry.key === group) return offset + indexInGroup;
      offset += entry.items.length;
    }
    return indexInGroup;
  }

  close(): void {
    this.palette.closePalette();
  }

  run(item: PaletteResult): void {
    this.close();

    if (item.group === 'destinations') {
      this.router.navigate(['/explore'], { queryParams: { q: item.label } });
      return;
    }

    if (item.group === 'trips') {
      const tripId = item.id.replace('trip-', '');
      this.router.navigate(['/itinerary', tripId]);
      return;
    }

    if (item.group === 'actions') {
      const text = item.id.startsWith('action-plan-')
        ? `Plan a trip to ${item.id.replace('action-plan-', '')}`
        : (this.query().trim() || 'Help me plan a trip');
      this.chat.prefillComposer(text);
      this.chatContext.setChatOpen(true);
      if (this.router.url !== '/') {
        this.router.navigate(['/']);
      }
      return;
    }

    const route = PAGE_ROUTES[item.id];
    if (route) this.router.navigate([route]);
  }

  private buildResults(query: string, destinations: DestinationListItem[]): PaletteResult[] {
    const q = normalizeSearchText(query);
    if (!q) return [];

    const results: PaletteResult[] = [];

    results.push({
      id: 'action-ask-ai',
      group: 'actions',
      label: query.trim() ? `Ask AI: "${query.trim()}"` : 'Ask AI assistant',
      subtitle: 'Open travel assistant',
      icon: '✨',
      score: 120,
    });

    for (const dest of destinations) {
      results.push({
        id: `dest-${dest.name}`,
        group: 'destinations',
        label: dest.name,
        subtitle: dest.region,
        icon: '📍',
        score: this.scoreText(dest.name, q) + 40,
      });
      results.push({
        id: `action-plan-${dest.name}`,
        group: 'actions',
        label: `Plan trip to ${dest.name}`,
        subtitle: 'Prefill assistant',
        icon: '🗺️',
        score: this.scoreText(dest.name, q) + 20,
      });
    }

    for (const page of PAGE_COMMANDS) {
      const score = Math.max(
        this.scoreText(page.label, q),
        ...(page.keywords ?? []).map((keyword) => this.scoreText(keyword, q)),
      );
      if (score > 0) {
        results.push({ ...page, score });
      }
    }

    if (this.auth.isLoggedIn()) {
      for (const trip of this.trips.trips()) {
        const haystack = `${trip.title} ${trip.destination}`;
        const score = this.scoreText(haystack, q);
        if (score > 0) {
          results.push({
            id: `trip-${trip.id}`,
            group: 'trips',
            label: trip.title,
            subtitle: trip.destination,
            icon: '🧭',
            score: score + 10,
          });
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 12);
  }

  private scoreText(value: string, query: string): number {
    const haystack = normalizeSearchText(value);
    if (!haystack || !query) return 0;
    if (haystack === query) return 100;
    if (haystack.startsWith(query)) return 80;
    if (haystack.includes(query)) return 50;
    return 0;
  }
}
