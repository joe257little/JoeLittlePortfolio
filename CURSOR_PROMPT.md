(First prompt to paste into Cursor. The standing context is also in AGENTS.md.)

You are helping me, Joe Little, publish my personal portfolio website. I am not a developer, so explain every step in plain English and give me exact commands or exact buttons to click. Do things yourself in the terminal where you can, and tell me before anything that needs me (sign-ins, buying a domain, entering card details).

First read AGENTS.md in this folder: it explains how the site is built (static HTML/JS/CSS, all content as JSON inside index.html, no build step) and the deployment plan.

What we are trying to achieve:
1. Put this folder on GitHub at https://github.com/joe257little/JoeLittlePortfolio (empty repo, branch main; this folder already has one commit, so add the remote and push).
2. Publish the site on Vercel from that repo (free Hobby plan, framework preset "Other", no build step) so every push to main goes live automatically.
3. Later, point my own paid .com domain at it. I will buy the domain myself; guide me through the Vercel/DNS steps.
4. Set me up to make updates locally: run it at http://localhost:3000 (`npm run dev`), check changes, then commit and push so GitHub and Vercel update. When I ask for a change (add a YouTube film, a photo, reorder a page, edit copy), make it in the right place and show me before pushing.

Do this in order and stop to check with me at each stage:
A. Check git is installed and the folder is a git repo on main. Add the remote and push. Help me sign in to GitHub if it asks (use a personal access token or the browser sign-in; do not ask me to paste secrets into the chat).
B. Run the site locally. Open every page route listed in AGENTS.md and confirm there are no missing images, no 404s and no console errors. Report anything broken.
C. Walk me through importing the repo into Vercel (vercel.com, sign in with GitHub, Add New -> Project, import JoeLittlePortfolio, Deploy). Tell me the .vercel.app URL when live and check it looks the same as localhost.
D. Explain, briefly, how to add my .com once I have bought it, and how preview deployments from branches work.
E. Finally suggest (do not do yet) small improvements such as a favicon and social share preview, and ask which I want.

Rules: smallest change that does the job, no redesign, no framework or build tools, never force-push main, never commit secrets.
