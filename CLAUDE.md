# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:4321)
npm run build     # production build → dist/
npm run preview   # serve the built dist/ locally
```

There is no test suite or linter configured.

## Architecture

**Astro 5 static site** deployed to Cloudflare Pages. All pages are statically generated at build time — there is no server runtime.

### Content layer

Blog posts live in `src/content/blog/*.mdx`. The Zod schema in `src/content/config.ts` defines all required frontmatter fields (`title`, `description`, `pubDate`, `author`, `tags`, `featured`, `draft`, `ogImage`). Posts with `draft: true` are excluded from all collections at build time via the filter in `src/utils/posts.ts`.

Reading time is injected as `remarkReadingTime` (a custom remark plugin at `src/utils/reading-time.ts`) and is available as `minutesRead` in frontmatter after Astro processes it.

### Layout and components

`PostLayout.astro` wraps every blog post. It renders a two-column layout: the article on the left and a sticky `TableOfContents` sidebar (visible `xl:` and up) on the right. Headings are passed from the MDX page via `Astro.props`.

Components are organised by role:
- `src/components/blog/` — `PostCard`, `TableOfContents`, `TagBadge`
- `src/components/layout/` — `Header`, `Footer`, `BaseHead`
- `src/components/mdx/` — `Callout` (imported in MDX posts)
- `src/components/ui/` — `ThemeToggle`

### Theming

Dark/light mode is driven by the `.dark` class on the root element (`src/styles/global.css` defines CSS custom properties for both modes). Code blocks use `astro-expressive-code` with `github-dark` / `github-light` themes mapped to `.dark` / `:root:not(.dark)` selectors.

### AI Writing Agent

`scripts/writing-agent.mjs` is a Node.js script (no bundling needed) that runs in CI via `.github/workflows/writing-agent.yml` whenever an MDX file changes on `main`. It:
1. Detects changed `.mdx` files via `git diff HEAD~1 HEAD`
2. Fires three Claude API calls **in parallel** per post: voice analysis, technical fact-check, and a philosopher-style intro rewrite
3. Posts the combined results as a GitHub Issue labelled `writing-review`

Required secrets for this workflow: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN` (auto-provided), `GITHUB_REPOSITORY`, `GITHUB_SHA`.

### Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which runs `npm ci && npm run build` then deploys `dist/` to Cloudflare Pages via `wrangler-action`. Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

A self-contained Docker option also exists (`Dockerfile` + `nginx/nginx.conf`): multi-stage build produces a static nginx image on port 80.
