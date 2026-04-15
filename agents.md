# agents.md — lobs-ai.github.io

## What It Is

A **public GitHub Pages website** for Lobs AI — a personal agent runtime built by Rafe Symonds. It's a marketing/landing page that explains what Lobs is, its architecture, the project ecosystem, and the build timeline. Hosted at [lobslab.com](https://lobslab.com).

## Ecosystem Role

This is the **public face of Lobs AI** — the thing people see when they Google "Lobs" or visit lobslab.com. It positions lobs-core and the broader Lobs ecosystem for external audiences (recruiters, potential collaborators, curious developers).

**What it covers:**
- lobs-core — standalone TypeScript agent runtime (current version: v8)
- Architecture overview — orchestrator, workers, model tiers, fault tolerance
- Project ecosystem — lobs-core, lobs-nexus, lobs-memory, lobs-mobile
- Build timeline — v1 through v8, three months of iteration
- War stories — real production incidents and lessons learned

## Build & Run

No build step — pure static HTML/CSS/JS.

```bash
cd lobs-ai.github.io
open index.html        # open in browser (local)
# OR serve locally
python3 -m http.server 8000
# Then visit http://localhost:8000
```

**Stack:** Vanilla HTML, CSS, JavaScript. Six CSS files, one JS file. No framework, no build tools.

## File Layout

```
lobs-ai.github.io/
  index.html      — main page
  blog/           — blog posts
  css/            — stylesheets (6 files)
  styles.css      — main stylesheet
  js/             — JavaScript
  script.js       — main script
  CNAME           — custom domain (lobslab.com)
  LICENSE
  README.md
```

## Deployment

Deployed via GitHub Pages. The `CNAME` file specifies `lobslab.com` as the custom domain.

```bash
# Push to main → GitHub Pages auto-deploys
git push origin main
```

## Key Conventions

- **Static only** — no server-side rendering, no API calls, no build step
- **Single-page app** — all content in `index.html` with CSS sections
- **Open source** — MIT licensed, code is public
- **No tracking** — no analytics scripts (beyond pulse.json which is a simple heartbeat)

## Notes

- This is a **marketing page**, not a product — don't add features that belong in lobs-core here
- The blog directory exists but may be empty or minimal
- If updating architecture claims, verify them against lobs-core's actual implementation first
- CNAME confirms custom domain is lobslab.com (not lobs-ai.com or similar)
