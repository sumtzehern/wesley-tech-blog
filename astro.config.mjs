import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { remarkReadingTime } from './src/utils/reading-time.ts';

import cloudflare from "@astrojs/cloudflare";

/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const expressiveCodeOptions = {
  themes: ['github-dark', 'github-light'],
  themeCssSelector: (theme) => {
    if (theme.name === 'github-dark') return '.dark';
    return ':root:not(.dark)';
  },
  styleOverrides: {
    borderRadius: '8px',
    codeFontFamily: "'IBM Plex Mono', monospace",
  },
  defaultProps: {
    showLineNumbers: true,
  },
};

export default defineConfig({
  site: 'https://wesleysum.dev',

  markdown: {
    remarkPlugins: [remarkReadingTime],
  },

  integrations: [
    expressiveCode(expressiveCodeOptions),
    mdx(),
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],

  adapter: cloudflare()
});