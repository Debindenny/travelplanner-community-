export interface LegalSubsection {
  subtitle: string;
  bullets: string[];
}

export interface TermsSection {
  id: string;
  title: string;
  leadText?: string;
  bullets?: string[];
  subsections?: LegalSubsection[];
  contactLines?: string[];
}
