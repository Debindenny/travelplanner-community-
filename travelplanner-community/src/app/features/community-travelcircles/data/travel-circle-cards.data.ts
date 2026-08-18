export interface CircleMember {
  name: string;
  location: string;
  role?: 'Host';
  joinedLabel?: string;
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
  members: CircleMember[];
  audience?: 'Everyone' | 'Women only' | 'Men only';
  initialStatus?: 'joined' | 'owner';
}

const STANDARD_MEMBERS: CircleMember[] = [
  { name: 'Priya Nair', location: 'India', role: 'Host' },
  { name: 'Marco Villa', location: 'Italy', joinedLabel: 'joined 3d ago' },
  { name: 'Emma Ross', location: 'UK', joinedLabel: 'joined 1w ago' },
  { name: 'Aarav Menon', location: 'India', joinedLabel: 'joined 1w ago' },
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
    initialStatus: 'joined',
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
    initialStatus: 'joined',
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
    members: STANDARD_MEMBERS,
  },
];
