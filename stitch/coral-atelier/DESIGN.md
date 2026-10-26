---
version: alpha
name: A Una Milla — Coral Atelier
description: Light mode for A Una Milla. Warm ivory room, deep blue voice, coral used once as the mile tick.
colors:
  primary: "#152C52"
  secondary: "#1C3E73"
  tertiary: "#E36A42"
  neutral: "#F1EBE1i"
  surface: "#FBF6EE"
  on-primary: "#F1EBE1"
  on-surface: "#152C52"
  quiet: "#5E7094"
  line: "rgba(21, 44, 82, 0.16)"
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

# A Una Milla — Coral Atelier

Light mode of one house. The dark pair is Teal Ledger. Same type, same mark, same pages. Only the materials change.

## Overview

A Una Milla answers one question for a traveller in Spain: how much could this trip cost in euros if the miles are used properly. The saving is the product. Coral Atelier should feel like a stationer’s desk in a sunlit room: warm ivory paper, deep blue ink, and a single coral tick that marks one mile.

The audience is a person who pays full fare and has never redeemed an award. The voice is short, plain, and English. No travel-brochure enthusiasm. No fintech dashboard.

The signature is an armillary mile-ring: two thin metal circles, one tilted, with a coral tick at twelve o’clock and a small coral bead on the orbit. It is a machined instrument, not a globe, not an airplane, not a map with a dotted route.

Mood: royal, spare, warm, precise. Density: a poster, not a brochure. One idea per view.

## Colors

Ivory is the room. Deep blue is the voice and the metal. Coral is the mile tick and nothing else.

- **Primary (#152C52):** Deep blue ink. Headlines, body, the filled button, the euro figure.
- **Secondary (#1C3E73):** A slightly lighter blue for the ring, hairline metal, and the secondary button stroke.
- **Tertiary (#E36A42):** Coral orange. The tick, a 2px rule, the bead on the ring. Never a text color. Never a button fill. It fails as small type on ivory.
- **Neutral (#F1EBE1):** Warm ivory page.
- **Surface (#FBF6EE):** The plaque, a half-step lighter than the room. Verdict cards and the composer sit here.
- **On-primary (#F1EBE1):** Label on the filled button.
- **Quiet (#5E7094):** Only for a swatch in the brand sheet. Live UI uses deep blue, or deep blue mixed toward ivory. Do not set paragraphs in this blue-gray.

## Typography

Two faces and a figure face. Bodoni Moda carries the house. Outfit carries the sentence. IBM Plex Mono carries the ledger.

- **Display:** Bodoni Moda 500, about 92px on desktop, line-height 0.88, slight negative tracking. Used for “The saving is the trip.” and for the euro amount when that amount is the point of the screen.
- **Headline:** Bodoni Moda 500, about 56px. Route titles.
- **Body:** Outfit 300, 18px, line-height 1.5. Short sentences. No italics for emphasis.
- **Labels:** Outfit 400, 12px, uppercase, tracking 0.16em. Eyebrows such as “A mile from your destination.”
- **Figures:** IBM Plex Mono 500 for cash, Avios, taxes, and airport codes. The giant saving stays in Bodoni. The euro sign on that giant figure is set in IBM Plex Mono so it does not collapse into a letter C.

## Layout

Desktop first, max width 1180px, centered. A 12px outer margin on a phone. One column of type on the left, the mile-ring on the right, aligned to the baseline of the headline. Below that, a three-column ledger separated by hairlines, not by cards.

Spacing is an 8px scale. Sections are separated by a 1px rule, not by a change of background. The page frame is a single hairline inset from the viewport. Do not draw a second frame inside it.

Phone: the ring stacks under the headline and is at most 320px tall. The ledger becomes one column. Buttons become full width.

## Elevation & Depth

No drop shadows. Depth is a lighter plaque on ivory, and a hairline in deep blue at 16% opacity. The ring may have a soft machined highlight because it is metal. The page itself is flat paper.

## Shapes

Corners are square. Buttons, inputs, plaques, and the page frame use 0px radius. A 2px radius is allowed only if a corner must be printed and would chip. No pills. No circles except the mile-ring and its bead.

## Components

- **Primary button:** Deep blue fill, ivory label, square, 46px tall. One per view. Label says what happens: “Open the thread.”
- **Secondary button:** Transparent, 1px deep-blue stroke, deep blue label. “See the brand.”
- **Plaque:** Ivory surface, 1px hairline, no shadow. The verdict lives here. The saving is the largest type inside it.
- **Input:** Transparent, 1px metal stroke, square. Placeholder in quiet blue only if contrast holds; otherwise deep blue at 60% mix toward ivory.
- **Mile tick:** A coral bar 10px wide and 2px tall, with a second coral bar 7px to its right. It introduces an eyebrow. It is not a bullet list icon.
- **Mark:** Armillary ring in deep blue metal, coral tick, coral bead. Wordmark “A Una Milla” in Bodoni. Second line “of your destination” in Outfit, small, not italic-decorative.

The home ledger reads: Cash €3,840 · Award 62,500 Avios + €214 taxes · Verdict: Use points. The hero figure is €1,890, labeled “sample saving.” These numbers are a brand sample, not a live fare. Say so in one line of small type.

## Do's and Don'ts

- Do make the euro saving the largest type on the home page and on the verdict.
- Do keep coral to the tick, the rule, and the bead.
- Do write in English, in short sentences, about Madrid to Johannesburg, business, 90 days.
- Do leave the page mostly empty.
- Don't use a second accent, a gradient, or a glow behind the headline.
- Don't put the saving in coral.
- Don't use airplane photos, map pins, passport stamps, or a dotted flight path as the hero.
- Don't use rounded cards, icon grids, three-column feature marketing, or a chat that looks like a phone messenger.
- Don't use Inter, Roboto, or a geometric sans as the display face.

## References

No public site uses this exact ivory, deep blue, and coral triad. Borrow a behavior from each, and do not copy the rest.

- [Aesop](https://www.aesop.com) — warm cream field, hairline, quiet commerce. Their page is almost monochrome. Take the paper. Leave their lack of an accent.
- [Cereal](https://www.readcereal.com) — travel written as an editorial, pale ground, type given room. Take the pace. Do not turn the home page into a photo archive.
- [Hermès](https://www.hermes.com) — one orange, used as a signature rather than a theme. Take that discipline for coral. Do not take their orange hue or their product grid.
- [Belmond](https://www.belmond.com) — a journey told at a royal register. Take the subject. Do not take their template, their photography crop, or their navigation.
