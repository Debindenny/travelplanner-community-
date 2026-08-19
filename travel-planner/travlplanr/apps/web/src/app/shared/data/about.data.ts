import { AboutFeature, AboutValueCard, AboutPillar, TeamMember, TimelineMilestone } from '../models/about.models';

const aboutIcon = (file: string) => `assets/images/icons/about/${file}`;
const landingImg = (file: string) => `assets/images/landing/${file}`;

export const ABOUT_HERO_IMAGE = landingImg('about-hero.jpg');
export const ABOUT_STORY_IMAGE = landingImg('about-story.jpg');



export const ABOUT_VALUE_CARDS: AboutValueCard[] = [
  {
    id: 'mission',
    icon: '🎯',
    title: 'Our Mission',
    description:
      'To revolutionize travel planning by making it accessible, personalized, and stress-free for everyone. We believe every journey should be as unique as the traveler.',
  },
  {
    id: 'vision',
    icon: '🌍',
    title: 'Our Vision',
    description:
      'To become the most trusted travel companion worldwide, empowering millions to explore confidently and create unforgettable memories across the globe.',
  },
  {
    id: 'passion',
    icon: '✈️',
    title: 'Our Passion',
    description:
      'We are passionate travelers who understand the joy of discovery and the challenges of planning. Our team is dedicated to turning your travel dreams into reality.',
  },
];



export const ABOUT_FEATURES: AboutFeature[] = [
  {
    id: 'ai-planning',
    icon: aboutIcon('ai-powered.svg'),
    title: 'AI-Powered Trip Planning',
    description:
      'No need to start from scratch. Our smart AI builds your itinerary in seconds just tell us where and when.',
  },
  {
    id: 'customization',
    icon: aboutIcon('customization.svg'),
    title: 'Built for Customization',
    description:
      'Traveling solo or as a group? Luxury or budget? Quick trip or extended escape? Customize your trip just the way you like.',
  },
  {
    id: 'transfers',
    icon: aboutIcon('inter-city.svg'),
    title: 'Smart Inter-City Transfers',
    description:
      'From flights to trains to car rentals we help you move smoothly city to city, all factored into your plan.',
  },
  {
    id: 'one-stop',
    icon: aboutIcon('one-stop.svg'),
    title: 'One-Stop Platform',
    description: 'Plan transport, stays, and activities all in one flow. No jumping across websites or apps.',
  }
];

export const ABOUT_PILLARS: AboutPillar[] = [
  {
    id: 'guided',
    value: 'Guided',
    label: 'Planning Flow',
    description: 'Move from preferences to a structured itinerary without juggling scattered notes.'
  },
  {
    id: 'editable',
    value: 'Editable',
    label: 'Itineraries',
    description: 'Adjust activities, stays, and transport as your trip takes shape.'
  },
  {
    id: 'partner-linked',
    value: 'Partner',
    label: 'Booking Links',
    description: 'Review options in TRAVL PLANR, then book directly with trusted providers.'
  }
];

export const ABOUT_TEAM: TeamMember[] = [
  {
    id: 'product',
    name: 'Product Team',
    role: 'Planning Experience',
    bio: 'Designs the itinerary flow, editing tools, and booking handoff so travelers stay in control from first idea to final plan.',
    favoriteDestination: 'User-led planning',
    initials: 'PT',
    colorClass: 'bg-primary text-white'
  },
  {
    id: 'travel-research',
    name: 'Travel Research Team',
    role: 'Destination Quality',
    bio: 'Reviews destination patterns, partner handoffs, and common planning edge cases so generated trips stay practical and easy to refine.',
    favoriteDestination: 'Practical trip details',
    initials: 'TR',
    colorClass: 'bg-indigo-600 text-white'
  }
];

export const ABOUT_TIMELINE: TimelineMilestone[] = [
  {
    year: '2023',
    title: 'The Seed Idea',
    description: 'Frustrated by managing 12 browser tabs for a weekend trip to Rome, we sketched the first mockup on a napkin.'
  },
  {
    year: '2024',
    title: 'Alpha Release',
    description: 'Built and tested the core AI planner, refining the recommendation experience around editable day-by-day itineraries.'
  },
  {
    year: '2025',
    title: 'Going Global',
    description: 'Expanded the planning model for multi-city trips, inter-city transfers, and direct handoffs to trusted booking partners.'
  },
  {
    year: '2026',
    title: 'TRAVL PLANR Today',
    description: 'Focused on making customizable travel planning clearer, faster, and easier to verify before travelers book.'
  }
];


