export type CommunityTab = 'Home' | 'Discover' | 'Destinations' | 'Trips' | 'Travel Circles' | 'Events' | 'Saved';
export type FeedFilter = 'For You' | 'Following' | 'Near My Trip' | 'Questions' | 'Trip Plans' | 'Tips' | 'Photos';
export type ViewMode = 'Feed' | 'Map';
export type DestinationSort = 'Popular' | 'Near me';
export type StoryStatus = 'There now' | 'Going soon' | 'Recently visited';
export type PostKind = 'INSIGHT' | 'POLL' | 'VIDEO' | 'PHOTO' | 'ITINERARY' | 'MEETUP' | 'QUESTION' | 'TRAVEL BUDDY';
export type PostCta = 'addToTrip' | 'remix' | 'join' | 'answer' | 'save';
export type ModalKind =
  | 'composerMenu'
  | 'composerForm'
  | 'addToTrip'
  | 'remix'
  | 'story'
  | 'postOptions'
  | 'discoverDetail'
  | 'savedDetail'
  | 'destinationDetail'
  | 'eventDetail';
export type SavedCollectionKind = 'Tip' | 'Trip' | 'Spot';
export type SavedCollectionTab = 'All' | 'Tips' | 'Trips' | 'Spots';

export interface CommunityStory {
  id: string;
  name: string;
  place: string;
  status: StoryStatus;
  image: string;
}

export interface PostComment {
  id: string;
  author: string;
  text: string;
  when: string;
  likes: number;
}

export interface PollOption {
  id: string;
  label: string;
  basePercent: number;
}

export interface TripRouteStop {
  city: string;
  nights: string;
  hasNext: boolean;
}

export interface TripStat {
  label: string;
  value: string;
}

export interface MeetupDetails {
  month: string;
  day: string;
  when: string;
  where: string;
  going: string;
}

export interface CommunityPost {
  id: string;
  kind: PostKind;
  tone: string;
  tags: FeedFilter[];
  place: string;
  author: string;
  initials: string;
  avatarGradient: string;
  meta: string;
  title: string;
  body?: string;
  image?: string;
  isVideo?: boolean;
  helpfulBase: number;
  cta?: PostCta;
  ctaLabel?: string;
  comments: PostComment[];
  poll?: PollOption[];
  pollVotesBase?: number;
  route?: TripRouteStop[];
  stats?: TripStat[];
  meetup?: MeetupDetails;
  authoredByMe?: boolean;
}

export interface JourneyStat {
  label: string;
  value: string;
}

export interface TravelMatch {
  id: string;
  name: string;
  home: string;
  dates: string;
  matchPercent: string;
  tags: string[];
  avatarGradient: string;
}

export interface TravelerRailItem {
  id: string;
  name: string;
  line: string;
  avatarGradient: string;
}

export interface TrendingItem {
  id: string;
  title: string;
  meta: string;
  image: string;
}

export type DiscoverPlace = 'All places' | 'Paris' | 'Tokyo' | 'Kyoto' | 'Lisbon' | 'Europe';
export type DiscoverSort = 'Most used' | 'Newest' | 'Most saved';

export interface DiscoverFact {
  label: string;
  value: string;
}

export interface DiscoverItem {
  id: string;
  tag: string;
  category: string;
  place: string;
  title: string;
  used: string;
  blurb: string;
  author: string;
  authorLine: string;
  body: string;
  facts: DiscoverFact[];
  points: string[];
  image: string;
  useCount: number;
  saveCount: number;
  freshness: number;
}

export interface UpcomingEvent {
  id: string;
  name: string;
  meta: string;
  month: string;
  day: string;
}

export type CrewMessageKind = 'text' | 'place' | 'poll' | 'meet' | 'split';
export type CrewCardKind = 'place' | 'poll' | 'meet' | 'split';

export interface CrewPollOption {
  id: string;
  label: string;
  basePercent: number;
}

export interface CrewMessage {
  id: string;
  kind: CrewMessageKind;
  author: string;
  text: string;
  when: string;
  sub?: string;
  image?: string;
  options?: CrewPollOption[];
}

export type EventBadgeKind = 'Meetup' | 'Food' | 'Online';
export type EventsFilter = 'All' | 'Near me' | 'Online';

export interface EventScheduleItem {
  time: string;
  text: string;
}

export interface EventHost {
  name: string;
  role: string;
  avatarGradient: string;
}

export interface EventLocation {
  name: string;
  note: string;
}

export interface EventListing {
  id: string;
  month: string;
  day: string;
  badge: EventBadgeKind;
  title: string;
  meta: string;
  travelersGoing: number;
  isOnline: boolean;
  image: string;
  host: EventHost;
  when: string;
  cost: string;
  groupMax: string;
  spacesLeft: number;
  description: string;
  schedule: EventScheduleItem[];
  location: EventLocation;
}

export interface SavedCollectionItem {
  id: string;
  kind: SavedCollectionKind;
  title: string;
  meta: string;
  image: string;
}

export interface DestinationStat {
  label: string;
  value: string;
}

export interface DestinationRecentPost {
  title: string;
  author: string;
  kind: string;
}

export interface CommunityDestination {
  id: string;
  name: string;
  members: string;
  livePlanning: string;
  hot?: string;
  image: string;
  stats: DestinationStat[];
  recentPosts: DestinationRecentPost[];
}

export interface SavedCollectionCard extends SavedCollectionItem {
  fromFeed: boolean;
}

export interface SavedFact {
  label: string;
  value: string;
}

export interface SavedDetailPayload {
  tag: string;
  place: string;
  title: string;
  image: string;
  used: string;
  facts: SavedFact[];
}

export interface ProfileMenuItem {
  icon: string;
  label: string;
  target: CommunityTab | null;
}

export interface SearchSuggestion {
  icon: string;
  label: string;
  kind: string;
  target: CommunityTab;
}

export interface AiPrompt {
  text: string;
  target: CommunityTab;
}

export interface PostTypeOption {
  formType: string;
  icon: string;
  label: string;
  hint: string;
}

export interface ComposerFormField {
  key: string;
  label: string;
  placeholder: string;
  multiline: boolean;
}

export interface ComposerFormDef {
  formType: string;
  icon: string;
  hint: string;
  chipsLabel: string;
  chips: string[];
  submitLabel: string;
  needsMedia: boolean;
  fields: ComposerFormField[];
}

export interface ItineraryItem {
  time: string;
  name: string;
}

export interface ItineraryDay {
  date: string;
  items: ItineraryItem[];
}

export interface TripPickOption {
  id: string;
  name: string;
  dates: string;
}

export interface AddKindOption {
  label: string;
  icon: string;
}

export interface AddDayOption {
  index: number;
  date: string;
  count: number;
}

export type AddTimeSlot = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';

export interface AddPreviewRow {
  time: string;
  name: string;
  isNew: boolean;
}

export interface AddPreview {
  head: string;
  rows: AddPreviewRow[];
}

export type PostOptionsAction = 'toggleSave' | 'copyLink' | 'mute' | 'block' | 'report';

export interface PostOptionsMenuItem {
  action: PostOptionsAction;
  label: string;
  hint: string;
  message: string;
}

export interface PostOptionsContext {
  postId: string;
  author: string;
  saved: boolean;
}

export interface StoryViewerPayload {
  name: string;
  place: string;
  status: StoryStatus;
  image: string;
}

export interface AddToTripPayload {
  spot: string;
  meta: string;
  image: string;
}

export interface RemixPayload {
  author: string;
}

export interface ModalState {
  kind: ModalKind;
  formType?: string;
  story?: StoryViewerPayload;
  addToTrip?: AddToTripPayload;
  remix?: RemixPayload;
  postOptions?: PostOptionsContext;
  discoverItem?: DiscoverItem;
  savedItem?: SavedDetailPayload;
  destinationItem?: CommunityDestination;
  eventDetail?: EventListing;
}

export interface CommunityHomeData {
  stories: CommunityStory[];
  posts: CommunityPost[];
  journeyStats: JourneyStat[];
  matches: TravelMatch[];
  travelersRail: TravelerRailItem[];
  trending: TrendingItem[];
  events: UpcomingEvent[];
  savedCollection: SavedCollectionItem[];
  eventListings: EventListing[];
  destinations: CommunityDestination[];
}
