export type CommunityTab = 'Home' | 'Discover' | 'Destinations' | 'Trips' | 'Travel Circles' | 'Events' | 'Saved';
export type FeedFilter = 'For You' | 'Following' | 'Near My Trip' | 'Questions' | 'Trip Plans' | 'Tips' | 'Photos';
export type ViewMode = 'Feed' | 'Map';
export type StoryStatus = 'There now' | 'Going soon' | 'Recently visited';
export type PostKind = 'INSIGHT' | 'POLL' | 'VIDEO' | 'PHOTO' | 'ITINERARY' | 'MEETUP' | 'QUESTION';
export type PostCta = 'addToTrip' | 'remix' | 'join' | 'answer' | 'save';
export type ModalKind = 'composerMenu' | 'composerForm' | 'addToTrip' | 'story' | 'postOptions' | 'eventDetail';

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
  cta: PostCta;
  ctaLabel: string;
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

export interface UpcomingEvent {
  id: string;
  name: string;
  meta: string;
  month: string;
  day: string;
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

export interface SideCircle {
  id: string;
  name: string;
  live: boolean;
  image: string;
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
  days: ItineraryDay[];
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

export interface PostOptionsMenuItem {
  label: string;
  hint: string;
  message: string;
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

export interface ModalState {
  kind: ModalKind;
  formType?: string;
  story?: StoryViewerPayload;
  addToTrip?: AddToTripPayload;
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
  eventListings: EventListing[];
  sideCircles: SideCircle[];
}
