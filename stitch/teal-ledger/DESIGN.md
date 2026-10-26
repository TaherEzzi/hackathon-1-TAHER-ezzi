---
version: alpha
name: A Una Milla — Teal Ledger
description: Dark mode for A Una Milla. Ink black room, warm ivory voice, electric teal used once as the mile tick.
colors:
  primary: "#F4EEE4"
  secondary: "#E7DCCB"
  tertiary: "#12E0C4"
  neutral: "#0A0A0C"
  surface: "#161618"
  on-primary: "#0A0A0C"
  on-surface: "#F4EEE4"
  quiet: "#A89F93"
  line: "rgba(231, 220, 203, 0.22)"
typography:
  display:
    fontFamily: Bodoni Moda
    fontSize: 92px
    fontWeight: 500
    lineHeight: 0.88
    letterSpacing: "-0.035em"
  headline:
    fontFamily: Bodoni Moda
    fontSize: 56px
    fontWeight: 500
    lineHeight: 0.92
    letterSpacing: "-0.03em"
  body:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: 300
    lineHeight: 1.5
  label:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.16em"
  figure:
    fontFamily: IBM Plex Mono
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.3
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  gutter: 24px
  margin: 48px
  page: 1180px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.none}"
    padding: 16px
    height: 46px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    padding: 16px
    height: 46px
  plaque:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.none}"
    padding: 24px
  input:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    padding: 14px
    height: 46px
  mile-tick:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.none}"
    height: 2px
---

# A Una Milla — Teal Ledger

Dark mode of one house. The light pair is Coral Atelier. Same type, same mark, same pages. Only the materials change.

## Overview

A Una Milla answers one question: how much could this trip cost in euros if the miles are used properly. The saving is the product. Teal Ledger should feel like a night ledger: ink black paper, warm ivory type, and a single electric teal tick that marks one mile.

The audience is a person who pays full fare and has never redeemed an award. The voice is short, plain, and English. The dark mode is not a gaming HUD and not a crypto dashboard. It is the same stationer’s desk after dark.

The signature is the same armillary mile-ring as the light mode: two thin ivory-metal circles, one tilted, with a teal tick at twelve o’clock and a small teal bead on the orbit. Machined, thin, reflective. Not a neon tube, not a globe, not an airplane.

Mood: royal, spare, nocturnal, precise. Density: a title card, not a control panel.

## Colors

Ink is the room. Warm ivory is the voice and the metal. Electric teal is the mile tick and nothing else.

- **Primary (#F4EEE4):** Warm ivory. Headlines, body, the filled button, the euro figure.
- **Secondary (#E7DCCB):** A slightly deeper ivory for the ring and for secondary strokes, so the metal is visible on black without turning gray.
- **Tertiary (#12E0C4):** Electric teal. The tick, a 2px rule, the bead. Never a paragraph. Never the euro figure. A large field of teal will look like a startup, so it stays a mark.
- **Neutral (#0A0A0C):** Ink black page. Not navy, not charcoal, not pure #000 if a hair of warmth is needed, but stay at this value.
- **Surface (#161618):** The plaque, lifted just off the ink. Verdict cards sit here.
- **On-primary (#0A0A0C):** Label on the ivory button.
- **Quiet (#A89F93):** Warm gray for captions only when ivory would be too loud. Do not fade body copy into this.

## Typography

Identical to Coral Atelier so the two modes are one brand.

- **Display:** Bodoni Moda 500, about 92px, line-height 0.88, slight negative tracking. “The saving is the trip.” and the giant euro amount.
- **Headline:** Bodoni Moda 500, about 56px. Route titles.
- **Body:** Outfit 300, 18px, line-height 1.5.
- **Labels:** Outfit 400, 12px, uppercase, tracking 0.16em.
- **Figures:** IBM Plex Mono 500 for the ledger. The giant saving stays in Bodoni. The euro sign on that figure is IBM Plex Mono.

On ink, Bodoni’s thin strokes can disappear. Keep the display weight at 500, not 400, and do not set it smaller than 40px on a phone.

## Layout

Same composition as Coral Atelier. Desktop first, max width 1180px. Type on the left, mile-ring on the right, three-column hairline ledger underneath. One hairline frame. No inner frame.

Phone: ring under the headline, at most 320px tall. Ledger in one column. Buttons full width.

## Elevation & Depth

No drop shadows and no outer glow. The plaque is #161618 on #0A0A0C. Separation is the ivory hairline at 22% opacity. The teal bead may carry a very small bloom, no larger than the bead itself. The page does not glow.

## Shapes

Corners are square. 0px radius on buttons, inputs, plaques, and the frame. No pills. Circles exist only on the mile-ring and its bead.

## Components

- **Primary button:** Ivory fill, ink label, square, 46px tall. One per view.
- **Secondary button:** Transparent, 1px ivory stroke, ivory label.
- **Plaque:** #161618, 1px hairline, no shadow. The saving is the largest type inside it, in ivory Bodoni.
- **Input:** Transparent, 1px ivory stroke, square.
- **Mile tick:** Teal, 10px by 2px, with a second teal bar 7px to its right.
- **Mark:** Armillary ring in warm ivory metal, teal tick, teal bead. Wordmark “A Una Milla” in Bodoni ivory. Second line “of your destination” in Outfit.

Same sample figures as the light mode: hero €1,890 “sample saving”; ledger Cash €3,840, Award 62,500 Avios + €214 taxes, Verdict: Use points. One line states that these are not a live fare.

## Do's and Don'ts

- Do keep the layout identical to Coral Atelier so the pair reads as light and dark, not as two brands.
- Do keep teal to the tick, the rule, and the bead.
- Do set the euro saving in warm ivory.
- Do write in English about Madrid to Johannesburg, business, 90 days.
- Don't flood the background with teal, grid lines, scanlines, or starfields.
- Don't add glassmorphism, neon borders, or a gradient mesh.
- Don't use airplane photos, map pins, or a flight-path hero.
- Don't use rounded cards, icon grids, or a messenger-style chat.
- Don't switch the display face. Bodoni in both modes.

## References

No public site uses this exact ink, warm ivory, and electric teal triad. Borrow a behavior from each, and do not copy the rest.

- [A24](https://a24films.com) — ink and bone, square corners, type doing the work of a picture. Take the contrast and the refusal of shadow. They use almost no accent color. Ours is the teal tick only.
- [SSENSE](https://www.ssense.com) — a black field with ivory type, editorial rather than a dashboard. Take the dark room. Do not take their commerce grid.
- [032c](https://032c.com) — one violent accent and a page that is otherwise black or white. Their accent is red. Use teal with the same scarcity.
- [Teenage Engineering](https://teenage.engineering) — the object on the page is an instrument. Take that for the mile-ring. Do not take their product photography or their orange.
