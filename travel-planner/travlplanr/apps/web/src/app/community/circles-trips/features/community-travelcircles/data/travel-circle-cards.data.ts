import { unsplashUrl } from '../../../shared/utils/unsplash';
import { mockCustomerId } from '../../../core/data/community-mock-users';

export interface CircleMember {
  name: string;
  customer_id: string;
  location: string;
  role?: 'Host';
  joinedLabel?: string;
  route?: string;
  dates?: string;
}

export interface TravelCircleCard {
  id: string;
  title: string;
  meta: string;
  visibility: 'Public' | 'Invite only' | 'Friends';
  description: string;
  activity: string;
  cta: 'Join' | 'Request';
  accent: string;
  accent2: string;
  image: string;
  members: CircleMember[];
  audience?: 'Everyone' | 'Women only' | 'Men only';
  initialStatus?: 'joined' | 'owner';
}

const STANDARD_MEMBERS: CircleMember[] = [
  { name: 'Ava Reyes', customer_id: mockCustomerId('Ava Reyes'), location: 'Paris', route: 'Paris', dates: 'Jun 3 - 6' },
  { name: 'Priya Nair', customer_id: mockCustomerId('Priya Nair'), location: 'India', role: 'Host', route: 'India → Paris', dates: 'Jun 3 - 8' },
  { name: 'Marco Villa', customer_id: mockCustomerId('Marco Villa'), location: 'Italy', joinedLabel: 'joined 3d ago', route: 'Italy → Paris', dates: 'Jun 1 - 6' },
  { name: 'Emma Ross', customer_id: mockCustomerId('Emma Ross'), location: 'UK', joinedLabel: 'joined 1w ago', route: 'UK → Paris', dates: 'Jun 4 - 11' },
];

export const TRAVEL_CIRCLE_CARDS: TravelCircleCard[] = [
  {
    id: 'tc1',
    title: 'Japan Spring 2027',
    meta: '18 members · 4 planning together',
    visibility: 'Invite only',
    description: 'Cherry-blossom trip planning — splitting JR passes and comparing machiya stays.',
    activity: 'Active 20m ago',
    cta: 'Request',
    accent: '#8b5cf6',
    accent2: '#c2569b',
    image: unsplashUrl('1493976040374-85c8e12f0c0e', 600),
    members: STANDARD_MEMBERS,
  },
  {
    id: 'tc2',
    title: 'Solo Women Travelers',
    meta: '2.4K members',
    visibility: 'Public',
    description: 'Safety notes, stays and meetups for women travelling alone.',
    activity: 'Active now',
    cta: 'Join',
    accent: '#5b3fa0',
    accent2: '#8b5cf6',
    image: unsplashUrl('1499856871958-5b9627545d1a', 600),
    members: STANDARD_MEMBERS,
  },
  {
    id: 'tc3',
    title: 'Slow Travel Europe',
    meta: '860 members',
    visibility: 'Public',
    description: 'Two weeks minimum, trains over flights, one city at a time.',
    activity: 'Active 1h ago',
    cta: 'Join',
    accent: '#8b5cf6',
    accent2: '#8b5cf6',
    image: unsplashUrl('1474487548417-781cb71495f3', 600),
    members: STANDARD_MEMBERS,
  },
  {
    id: 'tc4',
    title: 'Paris June Crew',
    meta: '9 members · overlapping dates',
    visibility: 'Invite only',
    description: 'Everyone here is in Paris the first week of June. Sharing a food walk and a museum day.',
    activity: 'Active 5m ago',
    cta: 'Request',
    accent: '#c2569b',
    accent2: '#c2569b',
    initialStatus: 'owner',
    image: unsplashUrl('1502602898657-3e91760cbb34', 600),
    members: STANDARD_MEMBERS,
  },
];

/** Shared CTA label for a travel circle, so the Travel Circles page, its
 * detail modal and the chatbot's discovery view never drift apart. */
export function circleCtaLabel(card: TravelCircleCard, isMember: boolean): string {
  if (card.initialStatus === 'owner') {
    return 'You created it';
  }
  if (isMember) {
    return card.cta === 'Join' ? 'Joined' : 'Requested';
  }
  return card.cta === 'Join' ? 'Join' : 'Request to join';
}
