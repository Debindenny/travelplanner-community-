import { BlogCategoryFilter } from '../models/blog.models';

/**
 * UI metadata for the blog category filter chips. This is presentation
 * configuration (labels for the filter bar), not blog content — the posts
 * themselves come from the backend CMS API (`/api/v1/cms/blog`).
 */
export const BLOG_CATEGORY_FILTERS: BlogCategoryFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'tips', label: 'Travel Tips' },
  { id: 'culture', label: 'Culture' },
  { id: 'budget', label: 'Budget' },
  { id: 'guides', label: 'Guides' },
];
