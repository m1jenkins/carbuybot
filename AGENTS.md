# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
CarBuyerBots is a single-page **static marketing site**. There is no framework, bundler, `package.json`, or backend. The entire app is `index.html` (inline CSS + a small inline `<script>`) plus static assets (`logo.svg`, `og.jpg`, `robots.txt`, `sitemap.xml`). Design-system source lives in `.styleseed/` and `docs/`; product/copy notes live in `carbuyerbots-plan.md` and `examples/`.

### Running it (dev)
Serve the repo root with any static file server, e.g. from `/workspace`:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. There is no build step and no watch/hot-reload — just edit `index.html` and refresh the browser.

### Build / lint / test
None are configured. There is no build (the site is served as-is), no linter, and no automated test suite. Deployment is handled by Vercel (see the `vercel/*` branch); no local build command is needed.

### Lead form / core functionality caveat
The email capture form in `index.html` (`#lead-form`) submits **client-side to the live Web3Forms API** (`https://api.web3forms.com/submit`) using a real access key hardcoded in the inline script. Submitting the form sends a **real lead notification** to the site owner's inbox. When testing the form end-to-end, use an obvious throwaway/test email so real submissions are easy to identify. A successful submission shows the status message "Got it. Check your inbox for the brief."; network/API failures show "Something went wrong. Please try again in a moment."
