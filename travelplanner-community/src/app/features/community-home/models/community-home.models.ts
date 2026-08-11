export interface CommunityHomeUiState {
  activeTab: string;
  filter: string;
  viewMode: string;
  profileOpen: boolean;
  searchOpen: boolean;
  aiOpen: boolean;
  modal: string | null;
  heroHasTrip: boolean;
  toast: string | null;
  searchQuery: string;
}
