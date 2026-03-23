import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

export function remarkReadingTime() {
  return function (tree: unknown, { data }: { data: Record<string, unknown> }) {
    const textOnPage = toString(tree as Parameters<typeof toString>[0]);
    const readingTime = getReadingTime(textOnPage);
    // inject into frontmatter-accessible remarkPluginFrontmatter
    data.astro = data.astro || {};
    (data.astro as Record<string, unknown>).frontmatter = (data.astro as Record<string, unknown>).frontmatter || {};
    ((data.astro as Record<string, unknown>).frontmatter as Record<string, unknown>).minutesRead = readingTime.text;
  };
}
