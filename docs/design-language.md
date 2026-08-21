# CarBuyerBots — Design Language

Derived via the [visual-taste-lab](https://github.com/siuserxiaowei/visual-taste-lab) workflow (VI audit → site-type classification → tokens → components → verification).

## Direction

- **Name:** Straight-shooter conversion
- **Archetype:** Consumer Product Launch × Sharp Transactional Utility
- **Site type:** Product website (single-service conversion page)
- **Audience:** U.S. car buyers who dread haggling and are skeptical of AI gimmicks and lead-gen funnels
- **Impression in 5 seconds:** "A real service will negotiate my car deal for a flat fee — and it isn't a scam."
- **What must feel true:** Buyer-funded, transparent numbers, human stays in control
- **Primary user task:** Enter email to start the brief
- **Main risk if the design is wrong:** Looks like dealer lead-gen or hype AI startup → trust collapses

## Brand / VI Audit

- **Existing logo:** Indigo gradient rounded tile (`#6366F1→#4338CA`) with white steering-wheel glyph — the only place gradients are allowed
- **Logo shape language:** App-like tile, modest radius (~25% corners), thin white strokes, centered crosshair geometry → informs 10–24px radius system
- **Primary color:** `#4F46E5` indigo (from logo) / role: brand presence, agent identity, primary CTAs, selected states
- **Secondary color:** `#0A0F1C` deep navy / role: authority surfaces for evidence sections
- **Accent color:** `#047857` green / role: money-saved semantics ONLY (savings, guarantee, checkmarks)
- **Neutral palette:** warm off-white base `#FBFBF9`, white surfaces, `#E6E8EE` hairlines, ink scale `#0D1424→#5D6781`
- **Why this VI fits:** Indigo reads "capable software agent," not "dealership flags"; green reserved for money builds the save-more promise; restraint signals we don't need tricks
- **Must not be mistaken for:** dealer lead-gen funnel, crypto-hype startup, template SaaS
- **References used:** existing logo + plan copy; archetype refs from visual-taste-lab
- **Rejected:** replacing indigo with fashionable neutrals/violet shifts (would orphan the logo)

## Company vs Product Decision

- Primary subject: product/transaction · Main visitor question: "Will this actually save me money with zero hassle?"
- Credibility proof: buyer-only compensation model, guarantee, comparison table, sample negotiation
- Conversion action: email submit (`#start`) · Navigation priority: How it works → Sample negotiation → Compare → Pricing

## Tokens

### Color

| Token | Value | Role |
|---|---|---|
| `--bg` | `#FBFBF9` | page background |
| `--surface` | `#FFFFFF` | cards, raised panels |
| `--ink` | `#0D1424` | headings |
| `--ink-soft` | `#39415A` | body-strong |
| `--muted` | `#5D6781` | body text (≥AA on bg) |
| `--line` | `#E6E8EE` | borders/dividers |
| `--accent` | `#4F46E5` | brand primary |
| `--accent-deep` | `#3B34C9` | hover state |
| `--accent-tint` | `#EEF0FF` | selected surface ("us" column) |
| `--green` / `--green-tint` | `#047857` / `#ECFDF5` | savings/guarantee only |
| `--dark` | `#0A0F1C` | authority sections |

Contrast notes: body text never below `--muted`; footnotes use `--muted` not faint gray; on dark sections use `≥ #A6ADC2`.

### Typography

- Inter 400–700 throughout; Instrument Serif italic reserved as humanizing accent — max one phrase per section heading
- H1 `clamp(40px,6.4vw,68px)` · H2 `clamp(30px,4.2vw,44px)` · H3 20px · body 15–18px · eyebrow 12px caps +0.12em tracking
- Numbers in stats/prices use `font-variant-numeric: tabular-nums`
- Max text width ~720px

### Geometry & Motion

- Container 1120px · section padding 104px desktop / 72px mobile
- Radius ladder: controls 10–12px, cards 14–20px, feature panel 24px
- Borders 1px solid `--line`; shadows soft single-source (`--shadow-sm/md`)
- Motion: 16px rise-on-reveal once per element, 200ms hovers, `prefers-reduced-motion` honored; no parallax/decorative animation
- Flat surfaces everywhere — glows/gradients live only in the logo

## Component Rules

- **Buttons:** one primary style (solid indigo) per viewport; ghost secondary; light-on-dark variant. No gradient fills.
- **Cards:** explain information boundaries; steps numbered via tinted square chip matching logo geometry
- **Tables:** preferred for credibility content; "us" column tinted `--accent-tint`, header in `--accent-deep`
- **Chat/negotiation panel:** dark surface, dealer = neutral slate bubbles, agent = solid indigo; header states *illustrative* status, never simulated live activity
- **Forms:** dark-section input with focus ring in accent; honest microcopy under submit
- **Badges:** launch-cohort flag uses `--accent-deep` on `--accent-tint`
- **Sticky mobile CTA:** price + primary button bar appears after hero scroll, hides at final form

## Copy Rules

- Honest by default: negotiation examples come from real live threads, condensed and anonymized (names, emails, phones, dealership identity removed); metrics state exactly what they measure (e.g., spread, not savings)
- No fake operational status ("live", responding counts)
- CTA verbs: Start / See — never "Claim", "Unlock"

## Anti-Patterns (project-specific)

- Decorative radial glows or gradient fills outside the logo mark
- Pulsing dots implying live negotiation traffic
- Unlabeled fictional transcripts, customers, or dollar figures
- Green used anywhere except money-saved/guarantee semantics
