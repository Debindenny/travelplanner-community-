import { TermsSection } from '../models/terms.models';

export const PRIVACY_LAST_UPDATED = '01.07.2026';
export const PRIVACY_EFFECTIVE_DATE = 'July 1, 2026';

export const PRIVACY_INTRO =
  'Welcome to Travl Planr! This Privacy Policy outlines how we collect, use, protect, and share your information when you use our AI-powered travel planning platform. We’re committed to keeping your data safe and transparent. Please read this carefully to understand your rights and our practices.';

export const PRIVACY_SECTIONS: TermsSection[] = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    leadText: 'We gather the following data to enhance your planning experience:',
    bullets: [
      'Data You Provide: When you create an account or save a trip, we may collect your name, email address, phone number, and trip preferences (e.g., destination, travel dates, group size, meal choices).',
      'Chat & Voice Data: Messages you send our travel assistant, and audio recordings when you use the voice assistant, are collected and processed (including by third-party AI providers — see Section 3) to generate replies and itineraries. Voice recordings are transcribed to text for this purpose.',
      'Automatic Data: We collect technical details like your device type, browser, IP address, site interactions, and approximate location (if enabled) to personalize itineraries and improve performance.',
      'No Financial Data: We do not collect or store payment or credit card information, as all bookings occur on partner websites (e.g., TravelNext, Tripadvisor).',
    ],
  },
  {
    id: 'how-we-use-data',
    title: '2. How We Use Your Data',
    leadText: 'Your information helps us:',
    bullets: [
      'Generate tailored itineraries using our AI based on your preferences.',
      'Enable real-time customizations, such as swapping transport or editing activities.',
      'Store and manage your saved trip plans for future access.',
      'Send optional updates, travel tips, or support notifications (you can opt out anytime).',
    ],
  },
  {
    id: 'sharing-with-partners',
    title: '3. Sharing with Third-Party Partners',
    bullets: [
      'When you click “Book Now,” you’re redirected to trusted partners (e.g., TravelNext, Tripadvisor) for bookings.',
      'Your booking and payment details are handled solely by these partners, subject to their privacy policies.',
      'We do not receive, store, or process your financial data and have no access to your booking history.',
      'AI Processing Partners: To generate itineraries and chat replies, your messages and trip inputs are sent to one or more AI providers — Groq, Google Gemini, Anthropic, and/or our own self-hosted Ollama instance — depending on which is available at the time. These providers process the text (and, for voice, the transcribed audio) solely to generate a response; review their respective privacy policies for how they handle data on their end.',
    ],
  },
  {
    id: 'cookies-tracking',
    title: '4. Cookies & Tracking',
    bullets: [
      'We use cookies to keep you signed in and remember your preferences. If we add third-party analytics tools in the future, this policy will be updated to name them before they go live.',
      'You can manage cookie preferences through your browser settings or by contacting us to opt out of non-essential tracking.',
    ],
  },
  {
    id: 'data-security',
    title: '5. Data Security',
    bullets: [
      'All data transfers are secured with HTTPS (SSL encryption) to protect your information.',
      'We employ strict internal controls, including limited access policies, to safeguard your data.',
      'We do not sell, rent, or share your personal information with advertisers. It is shared only as described in Section 3 (booking-partner redirects and AI processing partners).',
    ],
  },
  {
    id: 'privacy-choices',
    title: '6. Your Privacy Choices',
    leadText: 'You have control over your data:',
    bullets: [
      'Edit or Delete: Update or remove your personal details and saved trips via your account settings.',
      'Opt-Out: Unsubscribe from non-essential emails or notifications using the unsubscribe link in our messages.',
      'Data Deletion: Request full data erasure by emailing privacy@travlplanr.com. We’ll process your request unless legally required to retain certain data (e.g., for compliance purposes).',
    ],
  },
  {
    id: 'age-restrictions',
    title: '7. Age Restrictions',
    bullets: [
      'Travl Planr is designed for users aged 16 and older.',
      'We do not knowingly collect data from children under 16. If we detect such data, we’ll delete it and notify the parent or guardian.',
    ],
  },
  {
    id: 'legal-compliance',
    title: '8. Legal Compliance and Updates',
    bullets: [
      'We adhere to applicable privacy laws, including India’s Digital Personal Data Protection Act, 2023, and international standards where relevant (e.g., GDPR for EU users, CCPA for California residents).',
      'This policy may be updated to reflect changes in our services or legal requirements. Significant updates will be communicated via email or a notice on our site.',
      'The policy is accessible in the footer, account settings, and key pages (e.g., during account creation).',
    ],
  },
  {
    id: 'contact-support',
    title: '9. Contact & Support',
    leadText: 'Have questions or need assistance?',
    contactLines: ['privacy@travlplanr.com', 'TravlPlanR Private Limited, Coimbatore, India'],
  },
];
