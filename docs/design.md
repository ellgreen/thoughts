# Design

Dated entries, newest last. Each names what informed it.

## 2026-10-21: the two-ink zine

**Concept.** Every retro comes off the press as a two-colour riso print. The
room's thoughts are ink on paper, and when thoughts get grouped they overlap
and the inks overprint.

**The one memorable element.** Overprint. Where grouped notes overlap, pink and
blue multiply into a third colour (screen on dark stock). It appears where
ideas meet and nowhere else, so it stays meaningful. The wordmark uses plain
misregistration (pink set a hair off the blue) rather than overprint, because
at display size the overlap swamped the letters.

**Why this one.** Three directions were prototyped as clickable boards: the
wall (sticky notes, masking tape, dot stickers), typed cards (index cards,
over-typed redactions) and this one. The zine was chosen as the boldest and
the least like any retro tool or template.

**Type.**
- Bagel Fat One for the wordmark, headings, stage names and big numbers.
- Familjen Grotesk (variable) for everything read or clicked.
- Both self-hosted through Fontsource; only Bagel's Latin subsets are loaded.

**Colour.** OKLCH tokens in `ui/src/index.css`. Contrast measured in sRGB.

| Token | Light | Dark | Role |
|---|---|---|---|
| paper | `oklch(0.972 0.004 250)` #f4f6f8 | `oklch(0.2 0.03 262)` #0e1624 | ground |
| ink | `oklch(0.36 0.14 262)` #0e3685 | `oklch(0.93 0.02 250)` #dee9f5 | text, lines, solid buttons |
| ink-soft | `oklch(0.45 0.1 262)` | `oklch(0.8 0.04 250)` | secondary text |
| blue | `oklch(0.55 0.15 255)` #2971c6 | `oklch(0.72 0.12 250)` | riso blue: wordmark, marks, large type only |
| pink | `oklch(0.7 0.24 355)` #ff46a6 | same | fluoro pink: marks, votes, focus ring; never text |
| pink-tint | `oklch(0.86 0.1 355)` | `oklch(0.42 0.13 355)` | note and panel fill |
| blue-tint | `oklch(0.85 0.06 250)` | `oklch(0.38 0.09 255)` | note and panel fill |
| alert | `oklch(0.93 0.06 355)` | `oklch(0.4 0.12 355)` | problems |

Measured ratios: ink on paper 10.3, ink-soft on paper 6.9, ink on either tint
6.9 to 7.1, blue on paper 4.5 (large text only); dark ink on dark paper 14.8,
dark ink on dark tints 7.4 to 8.2. The overprint of pink and blue is #291f81
on light stock, #ffc1f9 on dark.

**Shape and layout.** Square blocks of flat ink, 2.5px rules, no shadows.
Round only for stamps (votes) and keys. Phone first; columns stack.

**Logo.** Two overlapping speech bubbles, pink and blue, with the overprint
where they meet, next to the outlined wordmark. `docs/brand/` holds the
lockup, wordmark and mark for light and dark; `ui/public/favicon.svg` is the
mark.

**Tells avoided.** Inter or Space Grotesk as the voice, violet primary,
gradients and glow, glassmorphism, coloured side-stripe cards (v1's retro
list had them), pulsing presence dots (v1 had one), emoji as icons (v1's
favicon was 💭), one large radius on everything, identical card grids,
italic serif display, cream grounds.

**Sources.**
- Anthropic, "Improving frontend design through skills":
  https://claude.com/resources/articles/improving-frontend-design-through-skills
- impeccable.style anti-patterns: https://impeccable.style/anti-patterns
- "The AI purple problem": https://dev.to/jaainil/ai-purple-problem-make-your-ui-unmistakable-3ono
- Wikipedia, Signs of AI writing: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- UAL, how to make a two-colour risograph print:
  https://www.arts.ac.uk/partnerships/outreach/insights/how-to/techniques/how-totechniques-create-a-two-colour-risograph-print
- People of Print riso showcase (two-ink overprint work):
  https://peopleofprint.com/best-of/pop-member-showcase-21-riso-prints/
- Dot voting background: https://en.wikipedia.org/wiki/Dot-voting and
  https://guides.18f.gov/methods/discover/dot-voting

## 2026-11-12: the calm board

The zine stays; there is less chrome around it. Worked through in
`ui-plan.md`, measured against the board as it was: four stacked header
rows, a text button on every note and group, display type on a dozen kinds
of heading.

**Bar and dock.** Chrome is one bar at the top and one dock at the bottom.
The bar holds what the room shares: the retro's title, the stages with the
next one as the single solid button, the timer, who is here and the retro
menu. The dock holds what is yours: whether you are done, the votes you
have left, and whatever the stage adds (moving a note, one at a time,
follow the room). Everything between them is thoughts.

**The line token.** `--color-line` is ink at 18%, for hairlines between
rows and under column titles. The 2.5px ink rule is kept for the bar's
edge, focused inputs, outline buttons and sheets. Lists separate with
space and a `line` hairline rather than tinted rows.

**Type budget.** Bagel Fat One is for the wordmark, one title per screen,
column titles, numerals (rank and timer) and sheet titles. Group titles,
team names, initials and labels are Familjen Grotesk bold.

**The pink offset.** A solid button's hover is a 3px pink block offset
down and to the right, and pressing moves the button onto it. It is a
misregistered second ink, a hard edge with no blur, not a shadow; a picked
up note gets the same block. Retro titles in lists do the same with their
letters.

**Motion.** Motion explains a change someone else made and never delays
input. Notes and piles glide to where a frame puts them; new notes print
in from the top; at the reveal the halftone dots develop into flat ink;
a band carries the new stage name across under the bar; votes land as
stamps. Everything goes through `motion/react` under `reducedMotion="user"`,
and a board over 120 notes swaps without moving.

**Desktop only.** Thoughts is used on a laptop in a meeting. Phones are out
of scope: the "phone first" line in the first entry no longer holds.
Narrow windows only have to not break.

Informed by: the measurements in `ui-plan.md`, print vocabulary (registration,
halftone, rubber stamps, the roller pass) and how the board read with four
people at once in the seeded retros.
