/**
 * Mock data for the illustrative story rail shown only while the real story feed
 * (CommunityStoryService) is empty. Isolated in its own file so this is the single
 * place to delete once real preview/onboarding stories come from the backend —
 * nothing outside this file should define preview persona data.
 */
export interface PreviewStoryDetail {
  name: string;
  location: string;
  status: 'there' | 'soon' | 'recent';
  image: string;
}

export const PREVIEW_STORY_DETAILS: PreviewStoryDetail[] = [
  { name: 'Maya', location: 'Japan', status: 'there', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80' },
  { name: 'Daniel', location: 'Peru', status: 'soon', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80' },
  { name: 'Sarah', location: 'Italy', status: 'recent', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80' },
  { name: 'Iker', location: 'Morocco', status: 'there', image: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=800&q=80' },
  { name: 'Nina', location: 'Iceland', status: 'soon', image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=800&q=80' },
  { name: 'Tom', location: 'Portugal', status: 'recent', image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=800&q=80' },
];
