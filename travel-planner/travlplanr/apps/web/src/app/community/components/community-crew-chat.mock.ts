/**
 * Mock data for the Crew group-chat preview UI. Isolated here so this is the
 * single place to delete/replace once a real chat/messages backend (e.g. a
 * crew-chat WebSocket + REST history endpoint) is wired up — nothing outside
 * this file should define crew chat content.
 */
import { mockCustomerId } from '../circles-trips/core/data/community-mock-users';
import { CircleMember } from '../circles-trips/features/community-travelcircles/data/travel-circle-cards.data';

export type CrewMessageKind = 'text' | 'poll' | 'meetup' | 'expense' | 'place';

interface CrewMessageBase {
  id: string;
  author: string;
  customer_id: string;
  time: string;
}

export interface CrewTextMessage extends CrewMessageBase {
  kind: 'text';
  text: string;
}

export interface CrewPollMessage extends CrewMessageBase {
  kind: 'poll';
  question: string;
  options: string[];
}

export interface CrewMeetupMessage extends CrewMessageBase {
  kind: 'meetup';
  title: string;
  meta: string;
}

export interface CrewExpenseMessage extends CrewMessageBase {
  kind: 'expense';
  title: string;
  meta: string;
  totalAmount: number;
  participantCount: number;
  splitType: 'equal';
}

export interface CrewPlaceMessage extends CrewMessageBase {
  kind: 'place';
  image: string;
  title: string;
  meta: string;
  ctaLabel: string;
}

export type CrewMessage =
  | CrewTextMessage
  | CrewPollMessage
  | CrewMeetupMessage
  | CrewExpenseMessage
  | CrewPlaceMessage;

export interface CrewChatMock {
  groupName: string;
  dateRange: string;
  memberCount: number;
  onlineCount: number;
  endsInDays: number;
  messages: CrewMessage[];
}

/** Per-circle chat context used for the joined-circle dropdown selector in the
 * crew chat header. Lets the chat and People tab switch data (members, counts,
 * messages) when the current user belongs to more than one circle. */
export interface ChatCircleContext {
  id: string;
  title: string;
  dateRange: string;
  memberCount: number;
  onlineCount: number;
  endsInDays: number;
  members: CircleMember[];
  messages: CrewMessage[];
}

export const PARIS_CREW_CHAT_MOCK: CrewChatMock = {
  groupName: 'Paris Crew',
  dateRange: '03–09 Jun',
  memberCount: 12,
  onlineCount: 4,
  endsInDays: 6,
  messages: [
    {
      id: 'm1',
      author: 'Priya Nair',
      customer_id: mockCustomerId('Priya Nair'),
      time: '09:14',
      kind: 'text',
      text: 'Landing Tuesday morning — anyone up for the Montmartre walk before the crowds?',
    },
    {
      id: 'm2',
      author: 'Marco Villa',
      customer_id: mockCustomerId('Marco Villa'),
      time: '09:31',
      kind: 'place',
      image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
      title: 'Louvre · Porte des Lions entrance',
      meta: 'Skips the pyramid queue · Day 3',
      ctaLabel: 'Add to my trip',
    },
    {
      id: 'm3',
      author: 'Emma Ross',
      customer_id: mockCustomerId('Emma Ross'),
      time: '10:02',
      kind: 'poll',
      question: 'Dinner Thursday — where?',
      options: ['Le Comptoir', 'Marais street food', 'Cook at the flat'],
    },
    {
      id: 'm4',
      author: 'Aarav Menon',
      customer_id: mockCustomerId('Aarav Menon'),
      time: '10:20',
      kind: 'meetup',
      title: 'Coffee at Saint-Jean',
      meta: 'Wed 08:30 · Montmartre',
    },
    {
      id: 'm5',
      author: 'Priya Nair',
      customer_id: mockCustomerId('Priya Nair'),
      time: '10:44',
      kind: 'expense',
      title: 'Museum pass',
      meta: '€19.50 each · 4 people',
      totalAmount: 78,
      participantCount: 4,
      splitType: 'equal',
    },
  ],
};
