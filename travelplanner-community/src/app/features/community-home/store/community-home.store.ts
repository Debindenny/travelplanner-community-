import { Injectable, computed, signal } from '@angular/core';

import {
  ADD_TO_TRIP_KINDS,
  COMPOSER_FORMS,
  CREW_MESSAGES,
  DISCOVER_CARDS,
  DISCOVER_CATEGORIES,
  DISCOVER_CATEGORY_TAGS,
  DISCOVER_FEATURE,
  DISCOVER_LIVE_COUNT,
  DISCOVER_TOP,
  TRIP_PICK_OPTIONS,
  buildCommunityHomeData,
} from '../../../core/data/community-mock-data';
import {
  AddToTripPayload,
  CommunityPost,
  CommunityTab,
  CrewMessage,
  CrewMessageKind,
  DestinationSort,
  EventsFilter,
  FeedFilter,
  ModalState,
  SavedCollectionTab,
  StoryViewerPayload,
} from '../../../core/models/community.models';
import { CreateCirclePayload } from '../../community-travelcircles/components/create-circle-modal/create-circle-modal.component';

const CURRENT_USER = {
  name: 'Ava Reyes',
  initials: 'AV',
  avatarGradient: 'linear-gradient(140deg,#0060EA,#4B2A63)',
};

const DESTINATION_FILTERS = ['All', 'Paris', 'Tokyo', 'Bali'];
const TOAST_DURATION_MS = 2400;

@Injectable({ providedIn: 'root' })
export class CommunityHomeStore {
  private readonly data = buildCommunityHomeData();
  private toastTimeout?: ReturnType<typeof setTimeout>;

  private readonly _posts = signal<CommunityPost[]>(this.data.posts);
  private readonly _activeTab = signal<CommunityTab>('Home');
  private readonly _filter = signal<FeedFilter>('For You');
  private readonly _eventsFilter = signal<EventsFilter>('All');
  private readonly _destinationFilterIndex = signal(0);
  private readonly _destinationSort = signal<DestinationSort>('Popular');
  private readonly _hasUpcomingTrip = signal(true);
  private readonly _planText = signal('');
  private readonly _profileOpen = signal(false);
  private readonly _aiOpen = signal(false);
  private readonly _modal = signal<ModalState | null>(null);
  private readonly _toast = signal<string | null>(null);

  private readonly _followedIds = signal<ReadonlySet<string>>(new Set());
  private readonly _savedIds = signal<ReadonlySet<string>>(new Set());
  private readonly _joinedIds = signal<ReadonlySet<string>>(new Set());
  private readonly _savedCollectionTab = signal<SavedCollectionTab>('All');
  private readonly _removedSavedCollectionIds = signal<ReadonlySet<string>>(new Set());
  private readonly _helpfulOnIds = signal<ReadonlySet<string>>(new Set());
  private readonly _openCommentPostIds = signal<ReadonlySet<string>>(new Set(['p1']));
  private readonly _commentLikeKeys = signal<ReadonlySet<string>>(new Set());
  private readonly _pollVotes = signal<Readonly<Record<string, string>>>({});
  private readonly _commentDrafts = signal<Readonly<Record<string, string>>>({});

  private readonly _formValues = signal<Readonly<Record<string, string>>>({});
  private readonly _formChips = signal<ReadonlySet<string>>(new Set());
  private readonly _formMediaAttached = signal(false);
  private readonly _audience = signal('Everyone in the community');
  private readonly _tripPick = signal('t1');
  private readonly _addKind = signal(ADD_TO_TRIP_KINDS[0]);
  private readonly _discoverCategory = signal(DISCOVER_CATEGORIES[0]);

  private readonly _inCrew = signal(false);
  private readonly _crewMessages = signal<CrewMessage[]>(CREW_MESSAGES);
  private readonly _crewDraft = signal('');
  private readonly _crewVotes = signal<Readonly<Record<string, string>>>({});
  private readonly _crewRsvpIds = signal<ReadonlySet<string>>(new Set());
  private readonly _crewSettledIds = signal<ReadonlySet<string>>(new Set());

  readonly stories = computed(() => this.data.stories);
  readonly journeyStats = computed(() => this.data.journeyStats);
  readonly matches = computed(() => this.data.matches);
  readonly travelersRail = computed(() => this.data.travelersRail);
  readonly trending = computed(() => this.data.trending);
  readonly events = computed(() => this.data.events);
  readonly sideCircles = computed(() => this.data.sideCircles);
  readonly destinations = computed(() => this.data.destinations);

  private readonly remainingSavedCollection = computed(() =>
    this.data.savedCollection.filter((item) => !this._removedSavedCollectionIds().has(item.id)),
  );

  readonly savedCollectionTab = this._savedCollectionTab.asReadonly();

  readonly savedCollectionTabs: SavedCollectionTab[] = ['All', 'Tips', 'Trips', 'Spots'];

  readonly savedCollectionItems = computed(() => {
    const tab = this._savedCollectionTab();
    return this.remainingSavedCollection().filter((item) => tab === 'All' || `${item.kind}s` === tab);
  });

  readonly savedCollectionEmpty = computed(() => this.savedCollectionItems().length === 0);

  readonly savedCollectionCount = computed(() => {
    const count = this.savedCollectionItems().length;
    return `${count} ${count === 1 ? 'item saved' : 'items saved'}`;
  });

  readonly activeTab = this._activeTab.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly eventsFilter = this._eventsFilter.asReadonly();
  readonly hasUpcomingTrip = this._hasUpcomingTrip.asReadonly();
  readonly planText = this._planText.asReadonly();
  readonly profileOpen = this._profileOpen.asReadonly();
  readonly aiOpen = this._aiOpen.asReadonly();
  readonly modal = this._modal.asReadonly();
  readonly toast = this._toast.asReadonly();
  readonly followedIds = this._followedIds.asReadonly();
  readonly savedIds = this._savedIds.asReadonly();
  readonly joinedIds = this._joinedIds.asReadonly();
  readonly helpfulOnIds = this._helpfulOnIds.asReadonly();
  readonly openCommentPostIds = this._openCommentPostIds.asReadonly();
  readonly commentDrafts = this._commentDrafts.asReadonly();
  readonly commentLikeKeys = this._commentLikeKeys.asReadonly();
  readonly formValues = this._formValues.asReadonly();
  readonly formChips = this._formChips.asReadonly();
  readonly formMediaAttached = this._formMediaAttached.asReadonly();
  readonly audience = this._audience.asReadonly();
  readonly tripPick = this._tripPick.asReadonly();
  readonly addKind = this._addKind.asReadonly();
  readonly discoverCategory = this._discoverCategory.asReadonly();

  readonly inCrew = this._inCrew.asReadonly();
  readonly crewMessages = this._crewMessages.asReadonly();
  readonly crewDraft = this._crewDraft.asReadonly();
  readonly crewVotes = this._crewVotes.asReadonly();
  readonly crewRsvpIds = this._crewRsvpIds.asReadonly();
  readonly crewSettledIds = this._crewSettledIds.asReadonly();

  readonly destinationFilter = computed(() => DESTINATION_FILTERS[this._destinationFilterIndex()]);
  readonly destinationSort = this._destinationSort.asReadonly();

  readonly visiblePosts = computed(() => {
    const filter = this._filter();
    const destination = this.destinationFilter();
    return this._posts().filter((post) => {
      const matchesFilter = filter === 'For You' || post.tags.includes(filter);
      const matchesDestination = destination === 'All' || post.place === destination;
      return matchesFilter && matchesDestination;
    });
  });

  readonly feedEmpty = computed(() => this.visiblePosts().length === 0);

  readonly visibleEventListings = computed(() => {
    const filter = this._eventsFilter();
    return this.data.eventListings.filter((event) => {
      if (filter === 'Online') {
        return event.isOnline;
      }
      if (filter === 'Near me') {
        return !event.isOnline;
      }
      return true;
    });
  });

  readonly showSimilarTravelers = computed(() => this._filter() === 'For You' || this._filter() === 'Near My Trip');

  readonly activeStory = computed(() => this._modal()?.story ?? null);
  readonly activeAddToTripPayload = computed(() => this._modal()?.addToTrip ?? null);

  readonly composerForm = computed(() => {
    const formType = this._modal()?.formType;
    return formType ? COMPOSER_FORMS[formType] ?? null : null;
  });

  readonly composerFormReady = computed(() => {
    const form = this.composerForm();
    if (!form) {
      return false;
    }
    const values = this._formValues();
    return form.fields.every((field) => (values[`${form.formType}|${field.key}`] ?? '').trim().length > 0);
  });

  readonly tripPickOptions = TRIP_PICK_OPTIONS;
  readonly addToTripKinds = ADD_TO_TRIP_KINDS;
  readonly currentUser = CURRENT_USER;

  readonly discoverLiveCount = DISCOVER_LIVE_COUNT;
  readonly discoverCategories = DISCOVER_CATEGORIES;
  readonly discoverFeature = DISCOVER_FEATURE;
  readonly discoverTop = DISCOVER_TOP;

  readonly filteredDiscoverCards = computed(() => {
    const tag = DISCOVER_CATEGORY_TAGS[this._discoverCategory()];
    return tag ? DISCOVER_CARDS.filter((card) => card.tag === tag) : DISCOVER_CARDS;
  });

  selectTab(tab: CommunityTab): void {
    this._activeTab.set(tab);
    this._modal.set(null);
    this._profileOpen.set(false);
  }

  selectFilter(filter: FeedFilter): void {
    this._filter.set(filter);
  }

  selectDiscoverCategory(category: string): void {
    this._discoverCategory.set(category);
  }

  selectEventsFilter(filter: EventsFilter): void {
    this._eventsFilter.set(filter);
  }

  joinCrew(): void {
    this._inCrew.set(true);
    this.showToast('You’re in · Paris Crew, 03–09 Jun');
  }

  setCrewDraft(text: string): void {
    this._crewDraft.set(text);
  }

  sendCrew(): void {
    const text = this._crewDraft().trim();
    if (!text) {
      return;
    }
    const message: CrewMessage = {
      id: `crew-${this._crewMessages().length}`,
      kind: 'text',
      author: CURRENT_USER.name,
      text,
      when: 'Just now',
      mine: true,
    };
    this._crewMessages.set([...this._crewMessages(), message]);
    this._crewDraft.set('');
  }

  addCrewCard(kind: CrewMessageKind): void {
    const CARD_CONTENT: Record<Exclude<CrewMessageKind, 'text'>, Pick<CrewMessage, 'text' | 'sub' | 'options'>> = {
      place: { text: 'Shared a place', sub: 'Tap to view details' },
      poll: {
        text: 'Quick poll for the crew',
        options: [
          { id: 'o0', label: 'Option A', basePercent: 0 },
          { id: 'o1', label: 'Option B', basePercent: 0 },
        ],
      },
      meet: { text: 'Propose a meet-up', sub: 'Time & place TBD' },
      split: { text: 'New expense', sub: 'Split evenly' },
    };
    const message: CrewMessage = {
      id: `crew-${this._crewMessages().length}`,
      kind,
      author: CURRENT_USER.name,
      when: 'Just now',
      mine: true,
      ...CARD_CONTENT[kind as keyof typeof CARD_CONTENT],
    };
    this._crewMessages.set([...this._crewMessages(), message]);
    this.showToast('Added to the crew chat');
  }

  voteCrewPoll(messageId: string, optionId: string): void {
    this._crewVotes.set({ ...this._crewVotes(), [messageId]: optionId });
    this.showToast('Vote counted');
  }

  toggleCrewRsvp(messageId: string): void {
    const wasGoing = this._crewRsvpIds().has(messageId);
    this._crewRsvpIds.set(this.toggledSet(this._crewRsvpIds(), messageId));
    this.showToast(wasGoing ? 'RSVP removed' : 'You’re in');
  }

  toggleCrewSettled(messageId: string): void {
    const wasSettled = this._crewSettledIds().has(messageId);
    this._crewSettledIds.set(this.toggledSet(this._crewSettledIds(), messageId));
    this.showToast(wasSettled ? 'Marked unpaid' : 'Marked as paid');
  }

  cycleDestinationFilter(): void {
    this._destinationFilterIndex.set((this._destinationFilterIndex() + 1) % DESTINATION_FILTERS.length);
  }

  setDestinationSort(sort: DestinationSort): void {
    this._destinationSort.set(sort);
  }

  toggleProfile(): void {
    this._profileOpen.set(!this._profileOpen());
  }

  closeProfile(): void {
    this._profileOpen.set(false);
  }

  toggleAiPanel(): void {
    this._aiOpen.set(!this._aiOpen());
  }

  closeAiPanel(): void {
    this._aiOpen.set(false);
  }

  toggleHeroTrip(): void {
    this._hasUpcomingTrip.set(!this._hasUpcomingTrip());
  }

  setPlanText(text: string): void {
    this._planText.set(text);
  }

  planTrip(): void {
    const text = this._planText().trim();
    this.showToast(text ? `Building: ${text}` : 'Tell TRAVL AI where you’re going');
  }

  openComposerMenu(): void {
    this._modal.set({ kind: 'composerMenu' });
  }

  selectPostType(formType: string): void {
    this._formValues.set({});
    this._formChips.set(new Set());
    this._formMediaAttached.set(false);
    this._modal.set({ kind: 'composerForm', formType });
  }

  backToComposerMenu(): void {
    this._modal.set({ kind: 'composerMenu' });
  }

  updateFormField(formType: string, fieldKey: string, value: string): void {
    this._formValues.set({ ...this._formValues(), [`${formType}|${fieldKey}`]: value });
  }

  toggleFormChip(chip: string): void {
    this._formChips.set(this.toggledSet(this._formChips(), chip));
  }

  setAudience(audience: string): void {
    this._audience.set(audience);
  }

  toggleMediaAttachment(): void {
    const attaching = !this._formMediaAttached();
    this._formMediaAttached.set(attaching);
    this.showToast(attaching ? 'Photo attached' : 'Attachment removed');
  }

  submitComposerForm(): void {
    const form = this.composerForm();
    if (!form || !this.composerFormReady()) {
      this.showToast('Fill the fields above to post');
      return;
    }

    const values = this._formValues();
    const fieldValue = (key: string) => (values[`${form.formType}|${key}`] ?? '').trim();
    const chips = Array.from(this._formChips());
    const firstField = fieldValue(form.fields[0].key);
    const lastField = fieldValue(form.fields[form.fields.length - 1].key);

    const post: CommunityPost = {
      id: `my-${form.formType}-${this._posts().length}`,
      kind: this.formKindFor(form.formType),
      tone: '#0060EA',
      tags: [],
      place: this.guessPlace(`${firstField} ${chips.join(' ')}`),
      author: CURRENT_USER.name,
      initials: CURRENT_USER.initials,
      avatarGradient: CURRENT_USER.avatarGradient,
      meta: `Just now · ${this._audience()}`,
      title: firstField,
      body: form.fields.length > 1 ? lastField : '',
      helpfulBase: 0,
      cta: 'save',
      ctaLabel: 'Save to collection',
      comments: [],
      authoredByMe: true,
    };

    if (form.formType === 'Start a Poll') {
      post.poll = fieldValue('options')
        .split('\n')
        .map((label) => label.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((label, index) => ({ id: `o${index}`, label, basePercent: 0 }));
      post.pollVotesBase = 0;
      post.body = '';
    }

    if (form.formType === 'Host a Meetup') {
      post.meetup = { month: 'JUN', day: '07', when: fieldValue('when'), where: chips.join(' · ') || 'Details in the post', going: '1 going' };
      post.cta = 'join';
      post.ctaLabel = 'Join meetup';
    }

    if (form.formType === 'Share Trip') {
      const stops = fieldValue('route').split('→');
      post.route = stops.map((city, index) => ({ city: city.trim(), nights: '', hasNext: index < stops.length - 1 }));
      post.stats = [
        { label: 'Cities', value: String(post.route.length) },
        { label: 'Days', value: '—' },
        { label: 'Activities', value: '—' },
        { label: 'Per person', value: '—' },
      ];
      post.cta = 'remix';
      post.ctaLabel = 'Make my version';
    }

    this._posts.set([post, ...this._posts()]);
    this._modal.set(null);
    this._filter.set('For You');
    this._destinationFilterIndex.set(0);
    this.showToast('Posted to the community');
  }

  deletePost(id: string): void {
    this._posts.set(this._posts().filter((post) => post.id !== id));
    this.showToast('Post deleted');
  }

  toggleFollow(id: string, name: string): void {
    const wasFollowing = this._followedIds().has(id);
    this._followedIds.set(this.toggledSet(this._followedIds(), id));
    this.showToast(wasFollowing ? `Unfollowed ${name}` : `Following ${name}`);
  }

  toggleSave(id: string): void {
    const wasSaved = this._savedIds().has(id);
    this._savedIds.set(this.toggledSet(this._savedIds(), id));
    this.showToast(wasSaved ? 'Removed from saved' : 'Saved to your collection');
  }

  selectSavedCollectionTab(tab: SavedCollectionTab): void {
    this._savedCollectionTab.set(tab);
  }

  removeSavedCollectionItem(id: string): void {
    this._removedSavedCollectionIds.set(this.toggledSet(this._removedSavedCollectionIds(), id, true));
    this.showToast('Removed from saved');
  }

  toggleHelpful(id: string): void {
    this._helpfulOnIds.set(this.toggledSet(this._helpfulOnIds(), id));
  }

  toggleJoin(id: string, name: string): void {
    const wasJoined = this._joinedIds().has(id);
    this._joinedIds.set(this.toggledSet(this._joinedIds(), id));
    this.showToast(wasJoined ? `Left ${name}` : `You’re going to ${name}`);
  }

  toggleComments(postId: string): void {
    this._openCommentPostIds.set(this.toggledSet(this._openCommentPostIds(), postId));
  }

  setCommentDraft(postId: string, text: string): void {
    this._commentDrafts.set({ ...this._commentDrafts(), [postId]: text });
  }

  postComment(postId: string): void {
    const text = (this._commentDrafts()[postId] ?? '').trim();
    if (!text) {
      this.showToast('Write something first');
      return;
    }
    this._posts.set(
      this._posts().map((post) =>
        post.id === postId
          ? { ...post, comments: [...post.comments, { id: `${postId}-c${post.comments.length}`, author: CURRENT_USER.name, text, when: 'Just now', likes: 0 }] }
          : post,
      ),
    );
    this._commentDrafts.set({ ...this._commentDrafts(), [postId]: '' });
    this._openCommentPostIds.set(this.toggledSet(this._openCommentPostIds(), postId, false));
    this.showToast('Comment posted');
  }

  likeComment(postId: string, commentId: string): void {
    this._commentLikeKeys.set(this.toggledSet(this._commentLikeKeys(), `${postId}_${commentId}`));
  }

  replyToComment(postId: string, authorFirstName: string): void {
    this._commentDrafts.set({ ...this._commentDrafts(), [postId]: `@${authorFirstName} ` });
    this.showToast(`Replying to ${authorFirstName}`);
  }

  votePoll(postId: string, optionId: string): void {
    this._pollVotes.set({ ...this._pollVotes(), [postId]: optionId });
    this.showToast('Vote counted');
  }

  votedOptionFor(postId: string): string | undefined {
    return this._pollVotes()[postId];
  }

  runPostCta(post: CommunityPost): void {
    switch (post.cta) {
      case 'addToTrip':
        this.openAddToTrip({ spot: post.title, meta: `Activity · ${post.place}`, image: post.image ?? '' });
        return;
      case 'remix':
        this._modal.set({ kind: 'addToTrip' });
        this.showToast('Building your version…');
        return;
      case 'join':
        this.toggleJoin(post.id, post.title);
        return;
      case 'answer':
        this._openCommentPostIds.set(this.toggledSet(this._openCommentPostIds(), post.id, true));
        this.showToast('Add your answer below');
        return;
      case 'save':
        this.toggleSave(post.id);
        return;
    }
  }

  openAddToTrip(payload: AddToTripPayload): void {
    this._modal.set({ kind: 'addToTrip', addToTrip: payload });
  }

  pickTrip(tripId: string): void {
    this._tripPick.set(tripId);
  }

  pickAddKind(kind: string): void {
    this._addKind.set(kind);
  }

  confirmAddToTrip(): void {
    const trip = this.tripPickOptions.find((option) => option.id === this._tripPick());
    this._modal.set(null);
    this.showToast(`Added to ${trip?.name ?? 'your trip'}`);
  }

  openStoryViewer(story: StoryViewerPayload): void {
    this._modal.set({ kind: 'story', story });
  }

  openPostOptions(): void {
    this._modal.set({ kind: 'postOptions' });
  }

  openCircleForm(): void {
    this._modal.set({ kind: 'circleForm' });
  }

  submitCircleForm(payload: CreateCirclePayload): void {
    this._modal.set(null);
    this.showToast(`“${payload.name}” created`);
    this._activeTab.set('Travel Circles');
  }

  runPostOptionsAction(message: string): void {
    this._modal.set(null);
    this.showToast(message);
  }

  closeModal(): void {
    this._modal.set(null);
  }

  showToast(message: string): void {
    clearTimeout(this.toastTimeout);
    this._toast.set(message);
    this.toastTimeout = setTimeout(() => this._toast.set(null), TOAST_DURATION_MS);
  }

  private formKindFor(formType: string): CommunityPost['kind'] {
    const kindByFormType: Record<string, CommunityPost['kind']> = {
      'Travel Tip': 'INSIGHT',
      'Photo / Video': 'PHOTO',
      'Share Trip': 'ITINERARY',
      'Ask Question': 'QUESTION',
      'Start a Poll': 'POLL',
      'Host a Meetup': 'MEETUP',
      'Find Travel Buddy': 'QUESTION',
    };
    return kindByFormType[formType] ?? 'INSIGHT';
  }

  private guessPlace(source: string): string {
    return ['Paris', 'Tokyo', 'Bali', 'Lisbon', 'Kyoto'].find((city) => source.includes(city)) ?? '';
  }

  private toggledSet<T>(source: ReadonlySet<T>, value: T, forceOn?: boolean): Set<T> {
    const next = new Set(source);
    const shouldHave = forceOn ?? !next.has(value);
    if (shouldHave) {
      next.add(value);
    } else {
      next.delete(value);
    }
    return next;
  }
}
