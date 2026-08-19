import { TermsSection } from '../models/terms.models';

export const TERMS_LAST_UPDATED = '01.07.2026';

export const TERMS_INTRO =
  'Welcome to Travl Planr! These Terms & Conditions explain how our website works, what we offer, and what you can expect as a user. We’ve written this in clear, simple language to make it easy to understand. Please read it carefully before using our services.';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'what-travl-planr-does',
    title: '1. What TRAVL PLANR Does (and Doesn’t)',
    subsections: [
      {
        subtitle: 'What We Do:',
        bullets: [
          'We provide an AI-powered tool to help you plan trips. You input your destination, dates, and preferences (e.g., budget, activities, transport), and we generate a day-by-day itinerary with suggested hotels, activities, and transport options.',
          'You can customize your itinerary by editing activities, swapping transport modes (e.g., flight to bus), or filtering hotels.',
          'We partner with trusted third-party services (e.g., TravelNext, Google Maps, Tripadvisor) and provide links that help you continue planning or booking on their platforms.',
        ],
      },
      {
        subtitle: "What We Don't Do:",
        bullets: [
          'We do not handle bookings, payments, or cancellations. All transactions occur on partner websites.',
          'We do not own or operate hotels, airlines, car rentals, or tour companies.',
          'We cannot guarantee real-time accuracy of prices, availability, or schedules, as these depend on our partners’ data.',
          'We do not offer visa services, taxi bookings, or international driving permit assistance. Please verify those requirements with official providers before you travel.',
        ],
      },
    ],
  },
  {
    id: 'ai-generated-content',
    title: '2. AI-Generated Content Disclaimer',
    bullets: [
      'Our AI uses algorithms to create itineraries based on your inputs and available data.',
      'This is for planning purposes only. You are responsible for reviewing all details (e.g., hotel availability, transport timings) before booking.',
      'Information provided (e.g., prices, schedules) may not reflect real-time updates from partner sites. Always verify before confirming.',
      'AI-generated content can be inaccurate or entirely fabricated — activity names, opening hours, prices, and availability may not correspond to any real place, service, or provider. Always independently verify any itinerary detail before relying on it or booking.',
    ],
  },
  {
    id: 'bookings-and-payments',
    title: '3. Bookings and Payments',
    bullets: [
      'All bookings are made on third-party websites (e.g., TravelNext, Tripadvisor).',
      'Travl Planr does not collect, process, or store payment information.',
      'Clicking “Book Now” redirects you to the partner’s site, where their terms, policies, and cancellation rules apply. Please review these before proceeding.',
    ],
  },
  {
    id: 'not-responsible-for',
    title: '4. We’re Not Responsible For',
    leadText: 'We are not liable for:',
    bullets: [
      'Errors, delays, or issues on third-party booking sites.',
      'Quality of services (e.g., hotel stays, transport) provided by partners.',
      'Schedule changes, cancellations, or refunds—contact the booking provider directly.',
      'Any loss or inconvenience due to inaccurate itinerary details (e.g., outdated prices).',
    ],
  },
  {
    id: 'user-responsibility',
    title: '5. User Responsibility',
    leadText: 'By using Travl Planr, you agree to:',
    bullets: [
      'Use the site solely for personal travel planning.',
      'Provide accurate trip details (e.g., destination, dates).',
      'Not misuse the AI tool, attempt to exploit redirect links, or copy our content.',
      'Understand that we are a planning platform, not a travel agency, and verify all itinerary details independently.',
    ],
  },
  {
    id: 'third-party-links',
    title: '6. Third-Party Link Usage',
    bullets: [
      'We collaborate with reputable partners (e.g., TravelNext, Google Maps, Tripadvisor) to enhance your planning experience.',
      'Leaving our site to book on a partner’s platform subjects you to their terms, privacy policies, and data practices.',
      'Travl Planr is not responsible for your experience or disputes on those sites.',
    ],
  },
  {
    id: 'customization-features',
    title: '7. Customization Features',
    bullets: [
      'You can customize itineraries using features like transport swapping (e.g., flight to train), activity editing, and hotel filtering.',
      'These customizations are suggestions based on available data. Availability on partner sites at the time of booking cannot be guaranteed.',
    ],
  },
  {
    id: 'changes-to-service',
    title: '8. Changes to Our Service',
    bullets: [
      'We may update the platform’s features, design, or content to improve your experience.',
      'These Terms will be revised as needed. The “Last Updated” date at the top reflects the latest version. We recommend checking periodically.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '9. Intellectual Property',
    bullets: [
      'All content on Travl Planr, including AI logic, UI/UX design, and itinerary structures, is our property.',
      'You may not copy, reproduce, or republish any part of our platform without written permission from Travl Planr Private Limited.',
    ],
  },
  {
    id: 'data-privacy',
    title: '10. Data Privacy',
    bullets: [
      'We collect minimal data (e.g., trip inputs) to generate itineraries, as outlined in our Privacy Policy.',
      'Your data is not sold or shared with advertisers. It is shared only (a) to facilitate redirects to partner booking sites, and (b) with the AI providers that generate your itineraries and chat responses (see our Privacy Policy for the specific providers), where their own privacy policies apply.',
      'We comply with applicable data protection laws, including India’s Digital Personal Data Protection Act, 2023. See our Privacy Policy for details.',
    ],
  },
  {
    id: 'contact-support',
    title: '11. Contact & Support',
    leadText: 'Need assistance or have questions?',
    contactLines: ['support@travlplanr.com', 'TravlPlanr Private Limited, Coimbatore, India'],
  },
];
