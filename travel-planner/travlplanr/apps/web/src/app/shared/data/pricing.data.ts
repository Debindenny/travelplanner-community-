export interface PricingPlan {
  id: 'free' | 'individual' | 'travel_partner';
  name: string;
  price: number;
  period: string;
  plansPerMonth: number;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    plansPerMonth: 2,
    features: ['2 AI itineraries / month', 'Basic destinations', 'Email support'],
    cta: 'Start for free',
  },
  {
    id: 'individual',
    name: 'Individual',
    price: 999,
    period: '/month',
    plansPerMonth: 10,
    features: [
      '10 AI itineraries / month',
      'Priority generation',
      'Affiliate booking links',
      'Export to PDF',
    ],
    highlighted: true,
    cta: 'Upgrade now',
  },
  {
    id: 'travel_partner',
    name: 'Travel Partner',
    price: 4999,
    period: '/month',
    plansPerMonth: 50,
    features: [
      '50 AI itineraries / month',
      'White-label options',
      'API access',
      'Dedicated support',
    ],
    cta: 'Contact sales',
  },
];
