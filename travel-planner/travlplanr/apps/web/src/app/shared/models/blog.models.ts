export type BlogCategory = 'destinations' | 'tips' | 'culture' | 'budget' | 'guides';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: BlogCategory;
  categoryLabel: string;
  author: string;
  publishedAt: string;
  readTime: string;
  featured?: boolean;
  status: 'published' | 'draft';
  tags: string;
  metaTitle?: string;
  metaDescription?: string;
  targetKeywords?: string;
}

export interface BlogCategoryFilter {
  id: BlogCategory | 'all';
  label: string;
}
