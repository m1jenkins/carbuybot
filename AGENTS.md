# CarBuyerBots

Marketing landing page for CarBuyerBots. The entire site is a single self-contained static
`index.html` (inline CSS + vanilla JS) plus local assets in `media/` and `logo.svg`. The
`.styleseed/` directory holds the locked design system (see `STYLESEED.md`), and
`carbuyerbots-plan.md` / `docs/` hold product copy and design notes.

## Cursor Cloud specific instructions

- This is a pure static site: there is no package manager, build step, bundler, automated tests,
  or lint config. Editing is done directly in `index.html` and the asset folders.
- Run it in development by serving the repo root over HTTP, e.g. `python3 -m http.server 8000`
  from `/workspace`, then open `http://localhost:8000/`. Opening `index.html` via `file://` also
  works but relative asset/`fetch` behavior is more faithful over HTTP.
- The lead-capture form (`#lead-form`) POSTs to the external Web3Forms API
  (`https://api.web3forms.com/submit`) using a hardcoded access key in `index.html`. Submitting
  sends a real lead. When testing, fill the field but do not click submit unless you intend to
  send a real submission.
- The hero email-thread animation and scroll reveals are `IntersectionObserver`-driven and pause
  offscreen / under `prefers-reduced-motion`; if animations look static, that is expected under
  reduced motion.
