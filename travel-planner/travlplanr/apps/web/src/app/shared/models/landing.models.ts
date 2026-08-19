export interface NavLink {
  label: string;
  /** i18n key rendered via the translate pipe when present; label is the fallback. */
  labelKey?: string;
  route: string;
  active?: boolean;
}

export interface HowItWorksStep {
  icon: string;
  title: string;
  description: string;
  iconBg: string;
}

export interface CarouselCard {
  title: string;
  subtitle: string;
  image: string;
}

export interface PartnerLogo {
  name: string;
  image?: string;
  className?: string;
  companionText?: string;
}

export interface TravelCategory {
  title: string;
  image: string;
  objectPosition?: string;
}

export interface DestinationTile {
  name: string;
  price: string;
  image: string;
  gridArea: string;
  imagePosition?: string;
  minHeight?: string;
}

export interface PackageCard {
  id?: string;
  title: string;
  price: string;
  days: string;
  group: string;
  theme: string;
  image: string;
  /** Real per-package rating from the API (0–5). Hidden when absent. */
  rating?: number;
  /** Review count from the API. Shown alongside rating when present. */
  reviewCount?: number;
}

export interface JourneyCard {
  subtitle: string;
  title: string;
  image: string;
}

export interface FooterLink {
  label: string;
  href: string;
  highlighted?: boolean;
  children?: { label: string; href: string }[];
}

export interface FooterLinkGroup {
  title?: string;
  links: FooterLink[];
}

export interface SupportContact {
  icon: string;
  label: string;
  href?: string;
}
