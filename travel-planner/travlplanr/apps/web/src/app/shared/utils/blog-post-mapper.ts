import { BlogPostData } from '../services/cms.service';
import { BlogCategory, BlogPost } from '../models/blog.models';

export function mapCmsPost(post: BlogPostData, sanitizeContent?: (html: string) => string): BlogPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: sanitizeContent ? sanitizeContent(post.content) : post.content,
    image: post.image,
    category: post.category as BlogCategory,
    categoryLabel: post.categoryLabel,
    author: post.author,
    publishedAt: post.publishedAt,
    readTime: post.readTime,
    featured: post.featured || false,
    status: post.status,
    tags: post.tags,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    targetKeywords: post.targetKeywords,
  };
}
