# Project context: Joseph Little portfolio

Read this first. It is the standing brief for any AI assistant working in this repo.

## Who and what
- Owner: Joe Little (Joseph Little), London. Podcast Studio Manager at HENI, freelance sound engineer and DJ. Not a developer: explain every step in plain English, give exact commands, never assume Git, Node or Vercel knowledge.
- This is a personal PORTFOLIO site, not a CV. Look: black, bold, big type, one long-scroll page per category. Keep that look unless Joe asks otherwise.
- Contact details and client names on the site are intentional and public.

## How the site is built (important)
- Plain static site. NO framework, NO bundler, NO build step. Vercel serves the repo root as-is. Do not introduce one without asking.
- `index.html`: page shell plus ALL content as JSON in `<script type="application/json" id="site-data">`. Top-level keys: `v`, `home`, `pages`, `order`, `entries`.
  - `home`: tagline, roles, clients, featured, pics, bg, carousel (the Highlights reel of YouTube films).
  - `pages`: five categories, keyed `radio`, `live`, `film`, `brand`, `programming` (nav title, route, intro, clients, pics, bg, optional carousel).
  - `order[pageKey]`: ordered list of entry ids shown on that page. The same entry can appear on several pages (e.g. `heni-talks`, `indie-spirit`).
  - `entries[id]`: title, role, meta, size (full/compact/brief), copy[] paragraphs, facts[[key,value]], links, img/w, pics[] (picture ids, or {id,url,f}), videos[{url,title}], `mix[]` (free order of pictures and films in one grid: tokens `p:<picId>` / `v:<youtubeId>`), `cols` (tiles per row).
- `app.js` renders everything from that JSON. Hash routes: `#/radio-podcasts`, `#/live-production`, `#/film-documentary-sound`, `#/brand-project-management`, `#/programming-curation`, plus contact. Nav order: Radio & Podcasts, Live Production, Film & Documentary Sound, Brand & Project Management, Programming & Curation, Contact.
- `style.css`: the whole look.
- Assets: `img/u/<32-hex-id>.jpg` = uploaded photos (the id is what `pics` refers to; `imgSrc()` in app.js maps id to this path). `img/*.jpg` = a few named pictures. `thumbs/<youtubeId>.jpg` = 640px-wide video thumbnails. `bg/programming.mp4` = background video.
- Video tiles show a LOCAL thumbnail and link out to YouTube (new tab). To add a film: add `{url,title}` to the entry's `videos` (or a carousel) AND add `thumbs/<youtubeId>.jpg` (640px wide; get it from https://i.ytimg.com/vi/<id>/maxresdefault.jpg, crop any black bars; hqdefault if maxres is missing).
- To add a photo: save as JPEG in `img/u/` with a 32-hex-character name, reference that id in `pics`. Keep photos reasonably small (aim under ~500 KB, 1600px wide max).

## Origin and a thing to know
- The site was first built and hosted as a claude.ai Artifact with a point-and-click "Edit site" mode. That edit code still exists in app.js but does nothing here (there is no `window.claude`). Do not delete it unless Joe asks. Edits now happen in these files.
- Content was exported from the live copy, with image ids rewritten to `img/u/<id>.jpg`. If something looks wrong, ask Joe for the original claude.ai link if you need to compare.

## Deployment plan (what we are doing)
1. Code lives in GitHub: `https://github.com/joe257little/JoeLittlePortfolio` (branch `main`). It started empty; the first push comes from this folder (it already contains one commit).
2. Hosting: Vercel, connected to that repo (the Vercel GitHub app is already authorised on Joe's account). Settings: framework preset "Other", no build command, no output directory override (root). Every push to `main` deploys to production; every other branch gets a preview URL. `vercel.json` sets `cleanUrls` and long cache headers on img/thumbs/bg.
3. Domain: Joe wants his own paid .com (not the free *.vercel.app name). He will buy it himself and enter his own card details; do not attempt payment. Registrar is undecided (Vercel Domains is simplest; Cloudflare Registrar ~$10-11/yr is the cheaper alternative, then point DNS at Vercel). Add the domain in Vercel -> Project -> Settings -> Domains, apex and www with a redirect, HTTPS automatic.
4. Day-to-day workflow Joe wants: edit locally -> `npm run dev` (serves at http://localhost:3000) -> check -> `git add -A && git commit -m "..." && git push` -> Vercel redeploys. Previously Joe made changes by asking Claude; now he will ask the assistant in this repo.

## Rules for the assistant
- Make the smallest change that does what Joe asked; do not redesign, rename content or "improve" copy unprompted. Joe's wording is deliberate.
- Before pushing, run the site locally and check every page route loads, there are no 404s for images/thumbs, and the browser console has no errors.
- Never commit secrets, tokens or card details. Never force-push `main`.
- Safe optional extras (ask first): favicon, Open Graph/Twitter share tags with a preview image, `robots.txt`, `sitemap.xml`, page `<title>` per route.
