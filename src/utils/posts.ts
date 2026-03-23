import { getCollection } from 'astro:content';

export function getSlug(id: string): string {
  return id.replace(/\.(md|mdx)$/, '');
}

export async function getSortedPosts() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getFeaturedPosts() {
  const posts = await getCollection('blog', ({ data }) => !data.draft && data.featured);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getAllTags(posts: Awaited<ReturnType<typeof getSortedPosts>>) {
  const tagSet = new Set<string>();
  posts.forEach((post) => post.data.tags.forEach((tag) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}
