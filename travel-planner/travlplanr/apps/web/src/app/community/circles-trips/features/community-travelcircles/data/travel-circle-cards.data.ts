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

/** The two model/example circles — mirrored as real seeded rows in the
 * `community_spaces` table (see services/planner/alembic/versions/0026_travel_circles_backend.py).
 * The Travel Circles page no longer reads this array directly (it loads live
 * data via CommunitySpacesService); this stays as the reference definition
 * those seed rows are kept in sync with. */
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
