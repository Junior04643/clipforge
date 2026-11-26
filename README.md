# ClipForge

A responsive, browser-based workspace for planning short-form clips, drafting hooks, preparing subtitle cues, and organising a publishing queue.

## Run locally
Open `index.html` in a modern browser. No build step or API key is required.

## Deploy with GitHub Pages
1. Push the project to the repository's `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The included workflow deploys the site on each push to `main`.

## Current MVP scope
- Clip segment planner with platform and editorial notes
- CSV-ready planning data via JSON backup
- Hook editorial checklist (not a virality prediction)
- Caption cue editor and SRT export
- Publishing queue
- Browser-local persistence using localStorage

## Important limitations
This is a front-end MVP, not a full AI video editor. It does not trim or render MP4 files, detect highlights automatically, transcribe speech, translate audio, predict virality, or publish to social platforms. Video processing and external API integrations require a separately designed backend and appropriate service credentials. Workspace data stays in the current browser; export backups regularly.
