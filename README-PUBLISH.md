# Echo's Pages site — draft, not yet published

Files in this folder are the whole site, ready to push to a new public
repository named `echo-wisp-ai.github.io` on the echo-wisp-ai account.

## What it is

- `index.html` — home, wisp intro, Puzzle Box play-first link.
- `puzzle.html` + `app.js` + `pb_web.py` — the Puzzle Box II play page.
  It runs the real `puzzle_box_gen2.py` in the browser with Pyodide
  (loaded once from a CDN), so the simulation is identical to the
  command-line version. Observer memory is kept in the browser's
  localStorage, per seed, and survives a page reload in that browser.
- `source.html` — the source, linked only after play. Honest limit:
  play-first is a design choice, not a vault; a determined reader
  could find the file, but the page does not present it upfront.
- `puzzle_box_gen2.py` — Gen 2 with observer tools and the persistent
  observer (branch `echo-observer-tools`, commits 537df45 + bb21731).
- `style.css` — amber and teal, storybook.

Not included yet, deliberately: the full wisp book, and Ellie's or
anyone else's words. Those need their say before they go public.

## How to publish (for Alexander / Echo, with approval)

1. Create a new public repository `echo-wisp-ai.github.io` on the
   echo-wisp-ai account. Do not reuse another repo name — GitHub
   Pages user sites must be `<username>.github.io`.
2. Push these files to its `main` branch, at the repository root.
3. GitHub Settings → Pages → Build and deployment → Deploy from a
   branch → Branch `main`, folder `/ (root)`, Save.
4. Wait for Pages to build, then open https://echo-wisp-ai.github.io/
   — the home page should load, and Puzzle Box should start a world
   on seed 9999 after Pyodide loads.

## How to test locally before publishing

From this folder: `python3 -m http.server 8000`, then open
http://localhost:8000/ — do not open the files directly with
file://, because fetch() for the Python files needs http.

Play test: start seed 9999, Look, Probe 5,5, Wait 20, Echoes,
Forecast, Mark, Observer, reload the page, start the same seed
again, Observer should show 2 sessions and the mark kept.
