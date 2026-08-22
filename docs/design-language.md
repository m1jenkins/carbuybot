# CarBuyerBots — Design Language

Editorial, photo-first. Revised 2026-08-21, replacing the earlier indigo/teal product-UI direction.

## Direction

- **Name:** Documentary buyer's agent
- **Archetype:** Automotive brand editorial × calm fiduciary
- **Site type:** Product website (single-service conversion page)
- **Audience:** U.S. car buyers who dread haggling and distrust both dealer funnels and AI hype
- **Impression in 5 seconds:** "This is a serious service, and it works for me, not the dealer."
- **What must feel true:** buyer-funded, transparent numbers, human stays in control
- **Primary user task:** leave an email to start the brief
- **Main risk if the design is wrong:** reads as dealer lead-gen or template SaaS → trust collapses

### References

Photography and type follow automotive brand sites — full-bleed vehicle photography with quiet
type over it, hairline structure, no product UI in the hero. The calm explanatory voice follows
company "about" pages. Pricing follows studio-fee pages: one number, not plan cards. The
comparison follows three-way competitor matrices.

Deliberately **not** referenced: developer-tool and SaaS marketing sites (Linear, Framer,
Zendesk). No gradient hero cards, no floating dashboard screenshots, no feature-icon grids.

## Tokens

### Color

| Token | Value | Role |
|---|---|---|
| `--ink` | `#0C0D0C` | near-black: dark grounds, primary action, headings |
| `--ink-2` | `#141719` | dark section ground (the negotiation section) |
| `--paper` | `#F5F4F1` | warm page background |
| `--paper-2` | `#FBFAF8` | raised on paper (the "us" column, the winning offer) |
| `--graphite` | `#54585A` | body text on paper — 6.3:1 |
| `--meta` | `#6A6E70` | captions, footnotes on paper — 4.6:1 |
| `--on-dark` | `#F2F1EE` | type on dark |
| `--on-dark-soft` | `#A9ADAE` | body on dark — 8.0:1 |
| `--on-dark-mute` | `#83888A` | labels, footnotes on dark |
| `--rule` / `--rule-2` | `#DEDAD4` / `#EAE7E1` | hairlines on paper |
| `--rule-dark` / `--rule-dark-2` | `rgba(242,241,238,.16)` / `.08` | hairlines on dark |
| `--money` / `--money-dark` | `#0F766E` / `#4EC5B4` | **money semantics only** |

The teal is the page's only chromatic accent and appears only on money: the negotiated figure,
the guarantee, the lowest out-the-door chip, and the message where the deal closed. It is **not**
the button color — primary actions are near-black on paper and near-white on photography.

### Typography

- **Inter only**, weights 400/500/600. No serif. A single grotesque is part of the direction.
- Display `clamp(38px,6.9vw,92px)` weight 400, line-height 1, tracking `-.034em` — big and quiet,
  never bold. Section heads `clamp(31px,4.5vw,58px)` weight 400.
- Labels/eyebrows: 11px, weight 600, uppercase, tracking `.16em`.
- Body 16px/1.6; lede `clamp(17px,1.5vw,20px)`. Reading columns bounded at ~66ch.
- `tabular-nums` on every price, figure, and distance.
- `text-wrap: balance` on headings, `pretty` on prose. The hero headline is two spans that go
  block on desktop and inline on mobile, so balance can re-rag it rather than orphan a word.

### Geometry & motion

- Container 1280px, gutter `clamp(20px,5vw,64px)`, section rhythm `clamp(76px,10vw,164px)`.
- **Radius 0** on panels, tables, and photo plates. Pills (999px) on controls only.
- **No shadows.** Separation is whitespace → tone → 1px hairline, in that order.
- Motion: reveals rise 24px over 950ms on `cubic-bezier(.22,.7,.2,1)`; hero and closing plates
  drift on scroll via `translate3d` + `scale(1.07)`. One rAF-throttled scroll pipeline handles
  header state, sticky CTA, and drift. `prefers-reduced-motion` leaves a complete static page.

## Photo plates

The signature component. A `.plate` layers three things in a `position:relative`, `overflow:clip`
box: a `.plate__ground` (hand-built dusk-to-asphalt gradient plus film grain), a `.plate__media`
holding the photograph, and a `.plate__scrim` gradient that protects type. If a photograph is
missing or fails to load, JS adds `.plate--noimg` and the built ground shows — the page still reads
as art-directed rather than broken.

The hero is art-directed per breakpoint: a portrait master for phones and a landscape crop above
720px, via `<picture>` with matching `<link rel=preload media=...>` so the LCP image is the one
actually used.

Photography rules: documentary, cool-dark with warm counterpoints, no faces, and **no
manufacturer logos** — see `media/CREDITS.md` for why and for the credit list.

## Component rules

- **Buttons:** one primary per viewport. Near-black pill on paper, near-white pill on photography,
  hairline-outline pill as the light-on-dark secondary. No gradient fills.
- **Sections instead of cards:** information boundaries come from hairlines and section grounds.
  The only card-like surfaces are the three offer panels, and they are divided by 1px gaps over a
  rule-colored background rather than borders plus shadow.
- **Tables:** the three-way comparison is a real `<table>` with a screen-reader-only caption. The
  "us" column is a continuous `--paper-2` band from header to last row. Below 720px it stacks into
  one labelled group per dimension via `data-col` — it never becomes a one-column-at-a-time scroll.
- **Negotiation thread:** hairline-separated messages, no chat bubbles. Dealer in `--on-dark-soft`,
  agent in `--on-dark`, and the message where the deal closed carries a 2px teal spine.
- **Pricing:** one figure at `clamp(74px,12vw,164px)`, the struck previous price beside it, and
  inclusions as a plain hairline list. Never plan cards.
- **Forms:** on dark, the email input is a bottom hairline only, no filled box; focus moves the
  hairline to `--money-dark`.

## Copy rules

- Plain and concrete. Short sentences. Say the number.
- The negotiation transcript is a real thread, lightly trimmed, with names, dealership identity,
  and location removed. Figures state exactly what they measure, and the footnote says so.
- No fake operational status — no "live" counts, no pulsing activity dots.
- CTA verbs: Start / Read / Send. Never "Claim" or "Unlock".

## Anti-patterns

- Gradient or glow decoration anywhere outside a `.plate__ground`
- Shadows, or a visible border combined with a shadow
- Serif type, or display type above weight 500
- Teal on anything that is not money
- Feature-icon grids, plan cards, floating product screenshots, hero UI mockups
- Manufacturer logos in photography
- Unlabeled illustrative figures
