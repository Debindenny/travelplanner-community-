export interface AboutValueCard {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface AboutFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface AboutPillar {
  id: string;
  value: string;
  label: string;
  description: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  favoriteDestination: string;
  initials: string;
  colorClass: string;
}

export interface TimelineMilestone {
  year: string;
  title: string;
  description: string;
}
