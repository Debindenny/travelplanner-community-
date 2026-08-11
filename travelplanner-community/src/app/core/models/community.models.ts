export type CommunityTab = 'Home' | 'Discover' | 'Destinations' | 'Trips' | 'Travel Circles' | 'Events' | 'Saved';
export type FeedFilter = 'For You' | 'Following' | 'Near My Trip' | 'Questions' | 'Trip Plans' | 'Tips' | 'Photos';
export type ViewMode = 'Feed' | 'Map';
export type ModalType = 'menu' | 'form' | 'add' | 'remix' | 'circle' | 'report';

export interface CommunityStory {
  id: string;
  name: string;
  place: string;
  status: string;
  accent: string;
  image: string;
}

export interface CommunityPost {
  id: string;
  kind: 'Tip' | 'Trip' | 'Question' | 'Photo' | 'Poll' | 'Journal' | 'Buddy';
  title: string;
  body: string;
  author: string;
  initials: string;
  accent: string;
  meta: string;
  badge?: string;
  image?: string;
  stats?: { label: string; value: string }[];
  chips?: string[];
}

export interface CommunityDestination {
  id: string;
  name: string;
  members: string;
  live: string;
  hot?: string;
  image: string;
  stats: { label: string; value: string }[];
}

export interface CommunityTrip {
  id: string;
  title: string;
  sub: string;
  author: string;
  initials: string;
  accent: string;
  updated: string;
  image: string;
  saves: string;
  stats: { label: string; value: string }[];
}

export interface CommunityEvent {
  id: string;
  name: string;
  meta: string;
  dateLabel: string;
  type: string;
  image: string;
  going: string;
}

export interface CommunityMatch {
  id: string;
  name: string;
  home: string;
  dates: string;
  match: string;
  tags: string[];
  accent: string;
  initials: string;
}

export interface CommunityTraveler {
  id: string;
  name: string;
  line: string;
  accent: string;
  initials: string;
}

export interface CommunityTrendingItem {
  id: string;
  title: string;
  meta: string;
  image: string;
}

export interface CommunityJourneyStat {
  label: string;
  value: string;
}

export interface CommunitySavedItem {
  id: string;
  kind: string;
  title: string;
  meta: string;
  image: string;
}

export interface CommunityDiscoverCard {
  id: string;
  tag: string;
  title: string;
  meta: string;
  image: string;
}

export interface CommunityCircle {
  id: string;
  name: string;
  meta: string;
  privacy: 'Public' | 'Invite only';
  desc: string;
  active: string;
  image: string;
}

export interface CommunityHomePayload {
  stories: CommunityStory[];
  posts: CommunityPost[];
  destinations: CommunityDestination[];
  trips: CommunityTrip[];
  events: CommunityEvent[];
  matches: CommunityMatch[];
  travelers: CommunityTraveler[];
  trending: CommunityTrendingItem[];
  journeyStats: CommunityJourneyStat[];
  savedItems: CommunitySavedItem[];
  discoverCards: CommunityDiscoverCard[];
  circles: CommunityCircle[];
}
