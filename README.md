# Joseph Little: portfolio

A static site. There is no build step: Vercel serves this folder as it is.

## Files
- `index.html` holds the page shell and ALL the site content (entries, copy, links, order) as JSON in `<script id="site-data">`.
- `app.js` renders the site from that JSON. `style.css` is the look.
- `img/u/` are the uploaded photos (named by id), `img/` other pictures, `thumbs/` video thumbnails (named by YouTube id), `bg/` background video.

## Run it locally
```
npm run dev
```
then open http://localhost:3000 (needs Node.js; or `python3 -m http.server 3000`).

## Making changes (with Claude Code, in this folder)
Ask for the change in plain words ("add this YouTube link to Patta", "reorder the Radio page"). Content edits go in the JSON in `index.html`; look and behaviour in `style.css` / `app.js`. New picture: put the .jpg in `img/u/`. New video: add a 640px-wide thumbnail as `thumbs/<youtube-id>.jpg`.
Check it at http://localhost:3000, then:
```
git add -A && git commit -m "what changed" && git push
```
Vercel redeploys on every push to `main` (a branch or pull request gets its own preview link).

## Note
The "Edit site" button from the claude.ai version does not exist here; edits are made through the files as above.
