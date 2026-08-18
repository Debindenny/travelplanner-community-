import {
  CarouselCard,
  DestinationTile,
  FooterLinkGroup,
  HowItWorksStep,
  NavLink,
  PartnerLogo,
  SupportContact,
} from '../models/landing.models';

const figma = (file: string) => `/assets/images/landing/figma/${file}`;
const icon = (file: string) => `/assets/images/icons/${file}`;

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', labelKey: 'NAV.HOME', route: '/' },
  { label: 'Explore', labelKey: 'NAV.EXPLORE', route: '/explore' },
  { label: 'Transfers', labelKey: 'NAV.TRANSFERS', route: '/transfers' },
  { label: 'About Us', labelKey: 'NAV.ABOUT', route: '/about' },
  { label: 'Pricing', labelKey: 'NAV.PRICING', route: '/pricing' },
  { label: 'Community', labelKey: 'NAV.COMMUNITY', route: '/community' },
];

export const DOCUMENT_NAV_LINKS: NavLink[] = [
  { label: 'Home', labelKey: 'NAV.HOME', route: '/' },
  { label: 'Explore', labelKey: 'NAV.EXPLORE', route: '/explore' },
  { label: 'About Us', labelKey: 'NAV.ABOUT', route: '/about' },
  { label: 'FAQ', labelKey: 'NAV.FAQ', route: '/faq' },
  { label: 'Pricing', labelKey: 'NAV.PRICING', route: '/pricing' },
  { label: 'Community', labelKey: 'NAV.COMMUNITY', route: '/community' },
];

export const TRAVEL_RESOURCE_LINKS = [
  { label: 'LANDING.RESOURCE_VISA', href: 'https://www.passportindex.org' },
  { label: 'LANDING.RESOURCE_INSURANCE', href: 'https://www.insuremytrip.com' },
  { label: 'LANDING.RESOURCE_CURRENCY', href: 'https://www.xe.com' },
  { label: 'LANDING.RESOURCE_PACKING', href: 'https://www.travelandleisure.com/trip-ideas/packing-tips' },
  { label: 'LANDING.RESOURCE_ALL', href: '/resources' },
];

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: icon('icon-plan.svg'),
    title: 'LANDING.HOW_STEP1_TITLE',
    description: 'LANDING.HOW_DATA_STEP1_DESC',
    iconBg: '#E5E4FF',
  },
  {
    icon: icon('icon-cube.svg'),
    title: 'LANDING.HOW_STEP2_TITLE',
    description: 'LANDING.HOW_DATA_STEP2_DESC',
    iconBg: '#E9F3FF',
  },
  {
    icon: icon('icon-ai.svg'),
    title: 'LANDING.HOW_STEP3_TITLE',
    description: 'LANDING.HOW_DATA_STEP3_DESC',
    iconBg: '#FFF5D8',
  },
];

export const POPULAR_DESTINATIONS: DestinationTile[] = [
  {
    name: 'Malaysia',
    price: '₹ 60,000',
    image: figma('malaysia.jpg'),
    gridArea: 'malaysia',
    imagePosition: 'center -3%',
  },
  {
    name: 'Maldives',
    price: '₹ 43,500',
    image: figma('maldives.jpg'),
    gridArea: 'maldives',
  },
  {
    name: 'Seychelles',
    price: '₹ 75,300',
    image: figma('seychelles.jpg'),
    gridArea: 'seychelles',
  },
  {
    name: 'Thailand',
    price: '₹ 56,000',
    image: figma('thailand.jpg'),
    gridArea: 'thailand',
  },
  {
    name: 'Switzerland',
    price: '₹ 1,65,000',
    image: figma('switzerland.jpg'),
    gridArea: 'switzerland',
  },
  {
    name: 'Singapore',
    price: '₹ 68,000',
    image: figma('singapore.jpg'),
    gridArea: 'singapore',
  },
];

export const MIDDLE_EAST_TRIPS: CarouselCard[] = [
  { title: 'Dubai', subtitle: 'LANDING.CARDS.ME_DUBAI', image: figma('dubai.jpg') },
  { title: 'Abu Dhabi', subtitle: 'LANDING.CARDS.ME_ABU_DHABI', image: figma('abu-dhabi.jpg') },
  { title: 'Bahrain', subtitle: 'LANDING.CARDS.ME_BAHRAIN', image: figma('bahrain.jpg') },
  { title: 'Qatar', subtitle: 'LANDING.CARDS.ME_QATAR', image: figma('qatar.jpg') },
  { title: 'Alula', subtitle: 'LANDING.CARDS.ME_ALULA', image: figma('alula.jpg') },
  { title: 'Saudi Arabia', subtitle: 'LANDING.CARDS.ME_SAUDI_ARABIA', image: figma('saudi.jpg') },
  { title: 'Kuwait', subtitle: 'LANDING.CARDS.ME_KUWAIT', image: figma('kuwait.jpg') },
  { title: 'Muscat', subtitle: 'LANDING.CARDS.ME_MUSCAT', image: figma('muscat.jpg') },
  { title: 'Doha', subtitle: 'LANDING.CARDS.ME_DOHA', image: figma('doha.jpg') },
];

export const UNITED_STATES_TRIPS: CarouselCard[] = [
  { title: 'New York', subtitle: 'LANDING.CARDS.US_NEW_YORK', image: figma('dubai.jpg') },
  { title: 'East coast', subtitle: 'LANDING.CARDS.US_EAST_COAST', image: figma('abu-dhabi.jpg') },
  { title: 'Orlando', subtitle: 'LANDING.CARDS.US_ORLANDO', image: figma('bahrain.jpg') },
  { title: 'west coast', subtitle: 'LANDING.CARDS.US_WEST_COAST', image: figma('west-coast.jpg') },
  { title: 'Los Angeles', subtitle: 'LANDING.CARDS.US_LOS_ANGELES', image: figma('west-coast.jpg') },
  { title: 'Dallas', subtitle: 'LANDING.CARDS.US_DALLAS', image: figma('dallas.jpg') },
];

export const TRENDING_EUROPE: CarouselCard[] = [
  { title: 'Belgium', subtitle: 'LANDING.CARDS.EU_BELGIUM', image: figma('belgium.jpg') },
  { title: 'Austria', subtitle: 'LANDING.CARDS.EU_AUSTRIA', image: figma('austria.jpg') },
  { title: 'London', subtitle: 'LANDING.CARDS.EU_LONDON', image: figma('london.jpg') },
  { title: 'Norway', subtitle: 'LANDING.CARDS.EU_NORWAY', image: figma('norway.jpg') },
  { title: 'Greece', subtitle: 'LANDING.CARDS.EU_GREECE', image: figma('greece.jpg') },
  { title: 'Spain', subtitle: 'LANDING.CARDS.EU_SPAIN', image: figma('spain.jpg') },
  { title: 'Finland', subtitle: 'LANDING.CARDS.EU_FINLAND', image: figma('finland.jpg') },
  { title: 'Italy', subtitle: 'LANDING.CARDS.EU_ITALY', image: figma('italy.jpg') },
];

export const BEYOND_TOURIST_TRAIL: DestinationTile[] = [
  {
    name: 'United Arab Emirates',
    price: '₹ 85,000',
    image: figma('dubai.jpg'),
    gridArea: 'uae',
  },
  {
    name: 'United State America',
    price: '₹ 3,20,500',
    image: figma('west-coast.jpg'),
    gridArea: 'usa',
  },
  {
    name: 'Europe',
    price: '₹ 2,52,500',
    image: figma('france-beyond.jpg'),
    gridArea: 'europe',
  },
  {
    name: 'Australia',
    price: '₹ 1,05,999',
    image: figma('australia-rated.jpg'),
    gridArea: 'australia',
  },
  {
    name: 'China',
    price: '₹ 2,32,000',
    image: figma('china.jpg'),
    gridArea: 'china',
  },
  {
    name: 'India',
    price: '₹ 2,56,000',
    image: 'assets/images/landing/iconic-india.jpg',
    gridArea: 'india',
  },
];

export const TOP_RATED_TRIPS: CarouselCard[] = [
  { title: 'France', subtitle: 'LANDING.CARDS.TR_FRANCE', image: figma('france.jpg') },
  { title: 'Bali', subtitle: 'LANDING.CARDS.TR_BALI', image: figma('bali-rated.jpg') },
  { title: 'Thailand', subtitle: 'LANDING.CARDS.TR_THAILAND', image: figma('thailand-rated.jpg') },
  { title: 'Dubai', subtitle: 'LANDING.CARDS.TR_DUBAI', image: figma('dubai-rated.jpg') },
  { title: 'Japan', subtitle: 'LANDING.CARDS.TR_JAPAN', image: figma('japan-rated.jpg') },
  { title: 'China', subtitle: 'LANDING.CARDS.TR_CHINA', image: figma('china-rated.jpg') },
  { title: 'Singapore', subtitle: 'LANDING.CARDS.TR_SINGAPORE', image: figma('singapore-rated.jpg') },
  { title: 'Australia', subtitle: 'LANDING.CARDS.TR_AUSTRALIA', image: figma('australia-rated.jpg') },
];

export const UNIQUE_EXPERIENCE_TRIPS: CarouselCard[] = [
  { title: 'Kenya', subtitle: 'LANDING.CARDS.UX_KENYA', image: figma('kenya.jpg') },
  { title: 'Bali', subtitle: 'LANDING.CARDS.UX_BALI', image: figma('bali.jpg') },
  { title: 'Goa', subtitle: 'LANDING.CARDS.UX_GOA', image: figma('goa.jpg') },
  { title: 'Fiji', subtitle: 'LANDING.CARDS.UX_FIJI', image: figma('fiji.jpg') },
  { title: 'Queensland', subtitle: 'LANDING.CARDS.UX_QUEENSLAND', image: figma('queensland.jpg') },
  { title: 'Morocco', subtitle: 'LANDING.CARDS.UX_MOROCCO', image: figma('morocco.jpg') },
  { title: 'Perth', subtitle: 'LANDING.CARDS.UX_PERTH', image: figma('perth.jpg') },
  { title: 'Egypt', subtitle: 'LANDING.CARDS.UX_EGYPT', image: figma('egypt.jpg') },
];

export const SOUTH_EAST_ASIA_TRIPS: CarouselCard[] = [
  { title: 'Philippines', subtitle: 'LANDING.CARDS.SEA_PHILIPPINES', image: figma('philippines.jpg') },
  { title: 'Sri Lanka', subtitle: 'LANDING.CARDS.SEA_SRI_LANKA', image: figma('sri-lanka.jpg') },
  { title: 'Singapore', subtitle: 'LANDING.CARDS.SEA_SINGAPORE', image: figma('singapore.jpg') },
  { title: 'Malaysia', subtitle: 'LANDING.CARDS.SEA_MALAYSIA', image: figma('malaysia.jpg') },
  { title: 'Japan', subtitle: 'LANDING.CARDS.SEA_JAPAN', image: figma('japan.jpg') },
  { title: 'China', subtitle: 'LANDING.CARDS.SEA_CHINA', image: figma('china.jpg') },
];

export const PARTNER_LOGOS: PartnerLogo[] = [
  {
    name: 'Google Maps',
    image: 'assets/images/partners/google-maps.png',
    className: 'h-[45px] w-[45px]',
    companionText: 'LANDING.PARTNERS.MAPS_COMPANION_TEXT',
  },
  { name: 'Tripadvisor', image: 'assets/images/partners/tripadvisor.png', className: 'h-[55px]' },
];

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    links: [
      { label: 'LANDING.FOOTER.ABOUT_US', href: '/about', highlighted: true },
      { label: 'LANDING.FOOTER.HOW_IT_WORKS', href: '/how-it-works' },
      { label: 'LANDING.FOOTER.BLOGS', href: '/blog' },
      {
        label: 'LANDING.FOOTER.TRAVEL_RESOURCE',
        href: '#',
        children: TRAVEL_RESOURCE_LINKS,
      },
    ],
  },
  {
    title: 'LANDING.FOOTER.LEGAL_TITLE',
    links: [
      { label: 'LANDING.FOOTER.FAQ', href: '/faq' },
      { label: 'LANDING.FOOTER.TERMS', href: '/terms' },
      { label: 'LANDING.FOOTER.PRIVACY', href: '/privacy' },
      { label: 'LANDING.FOOTER.CONTACT_US', href: '/contact' },
    ],
  },
];

export const SUPPORT_CONTACTS: SupportContact[] = [
  { icon: 'assets/images/footer/mail.svg', label: 'support@travlplanr.com', href: 'mailto:support@travlplanr.com' },
];

// Package theme text is plain English on purpose: PackageCardComponent (shared,
// outside this file's i18n ownership) renders `theme` directly without a
// translate pipe, so it cannot receive an i18n key here.
const READY_PACKAGE_THEMES: Record<string, string> = {
  France: 'Romance',
  Bali: 'Island of the Gods',
  Thailand: 'Kingdom of Thailand',
  Dubai: 'City of Gold',
  Japan: 'Land of the Rising Sun',
  China: 'Factory of the World',
  Singapore: 'The Lion City',
  Australia: 'Great Southern Land',
};

export const READY_PACKAGES = TOP_RATED_TRIPS.map((card) => ({
  title: card.title,
  price: '₹ 79,999',
  days: '6 Days',
  group: 'Family/ friends',
  theme: READY_PACKAGE_THEMES[card.title] || card.title,
  image: card.image,
}));

export const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://facebook.com/travlplanr', icon: 'assets/images/social/facebook.svg' },
  { label: 'Instagram', href: 'https://instagram.com/travlplanr', icon: 'assets/images/social/instagram.svg' },
  { label: 'X', href: 'https://twitter.com/travlplanr', icon: 'assets/images/social/x-twitter.svg' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/travlplanr', icon: 'assets/images/social/linkedin.svg' },
  { label: 'YouTube', href: 'https://youtube.com/@travlplanr', icon: 'assets/images/social/youtube.svg' },
];
