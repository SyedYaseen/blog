# syedyaseen.dev

Personal blog and notes — web tech, embedded systems, machine learning and
self-hosting.

Built with [Astro](https://astro.build), styled with Tailwind CSS v4, searched
with [Pagefind](https://pagefind.app). No UI framework.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check, build, and index for search
npm run preview  # serve the production build
```

## Writing

Posts live in `src/content/blog` as `.md` or `.mdx`. Every post needs
frontmatter:

```yaml
---
title: "Post title"
description: "One sentence; it is used in the index and in link previews."
date: "2026-01-31"
tags: ["linux", "docker"]
draft: false # optional; drafts are excluded from the build
---
```

Projects work the same way in `src/content/projects`, and also accept
`demoURL` and `repoURL`.

Headings in the body should start at `##` — the page renders the title as the
`h1`, and the outline is built from `h2` down.

## Design

One accent (amber), two typefaces from one superfamily: IBM Plex Mono for the
interface and IBM Plex Sans for long-form reading. Colours are CSS variables in
`src/styles/global.css`; `:root` is light and `.dark` swaps the same names, so
nothing else needs a dark-mode branch.

## Credits

Originally based on [Astro Micro](https://astro-micro.vercel.app/) by Trevor
Lee, itself a fork of [Astro Nano](https://astro-nano-demo.vercel.app/) by Mark
Horn. See `LICENSE`.
