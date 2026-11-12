# UI plan: the calm board

Written 2026-11-12 after walking every screen of 2.0.0 on a desktop
(1360×900) and a phone (375×812), light and dark, with a seeded four-person
retro taken through all four stages.

This is a plan to hand to whoever builds it. Each phase stands alone, ends
with `task check` green, and says which files it touches and how to tell it
is done. Do the phases in order; later ones assume the earlier structure.

The zine direction in `design.md` stays. Nothing here changes the inks, the
typefaces or the overprint rule. What changes is how much of the page is
chrome, how many things shout at once, and how the board moves.

## Phones are out of scope

Decided 2026-11-12, after phases 1 to 7: Thoughts is a desktop tool and
phone use does not matter. Every "Phone" paragraph, phone measurement and
"on a phone" check below is void. Do not build the phone variants that were
skipped (dock composer, column tabs, stage sheet), do not add touch-only
behaviour, and do not verify at phone widths. What already exists for
narrow screens can stay as long as it costs nothing to keep.

## What is wrong today

Measured, not felt:

| Finding | Evidence |
|---|---|
| The board starts below the fold | First note sits about 700px down a 900px desktop window, and 921px down an 812px phone screen. Above it: app header, title row, stage row, ready and timer strip, "From last time" panel, column headers. |
| Everything is the same loudness | The 2.5px ink rule is used for list rows, the strip, panels, pills, buttons, inputs, column underlines and dashed add buttons. Bagel Fat One is used at about ten levels: page titles, section headings, column titles, group titles, list rows, team chips, dialog titles, shortcut sections, numerals, avatar initials. |
| Stage pills look pressable and are not | They are `<span>`s. The real controls are two separate buttons on the far right whose labels change every stage. |
| The same control repeats on every item | A "…" menu on every note, a "Vote" button under every pile, "Bring everyone here" under every group, "Done / Carry over / Drop" on every old action. |
| Writing a thought is a modal | The most frequent action in a retro opens a dialog, from a button at the bottom of the column, with no key. Each thought is open, type, Enter, find the button again. |
| No theme switch | `index.css` already honours `data-theme="light"` and `"dark"`; nothing ever sets it. |
| Nothing moves | `motion` 14 is in `package.json` and is not imported anywhere. Notes from other people, regrouping, the reveal and the rerank into discussion are all hard swaps, which in a shared live board reads as things teleporting. |
| Grouping on a phone leans on a menu | Dragging uses HTML drag events only (`note.tsx`), which touch browsers handle poorly. The fallback is "…" then "Move to…" then a search sheet. Not tried on a real phone; check before and after. |
| Small things | "0 of 1 actions done" (plural). "Time's up" is set in pink text, which `design.md` rules out. Unvoted groups get the same giant rank numeral as the winner. The actions panel is a long scroll away on a phone. Settings has one Save for the form and another per column. The new retro sheet shows ten template chips, an AI box, a column editor, team, tags and a checkbox at once. |

Not verified: the browser pane used for the walkthrough froze CSS
animations, so dialog entrances were not seen moving. They work in the e2e
suite.

## Principles

1. **The paper is the board.** Chrome gets one bar at the top and one dock at
   the bottom. Everything else on the page is thoughts.
2. **Top is the room, bottom is you.** The bar holds what everyone shares:
   the retro, the stage, the timer, who is here. The dock holds what is
   yours: what you are writing, whether you are done, the votes you have
   left.
3. **One loud thing per screen.** One primary button, one heavy rule, one
   display heading. If a second thing needs weight, the first loses some.
4. **A control that repeats per item is an icon or a gesture**, not a text
   button. Text buttons are for things that appear once.
5. **Motion explains a change someone else made.** A note arriving, a pile
   forming, the stage moving on. It never delays input and never loops.
6. **Print vocabulary only.** Overprint stays reserved for grouped notes.
   The new effects are other things a press does: halftone that develops,
   misregistration, a stamp landing, a roller pass.

## Ground rules for whoever builds this

- No server changes. Every command, frame and projection rule stays as it
  is. If a phase seems to need one, stop and ask.
- Follow `CLAUDE.md`: tokens not raw colours, no gradients, glow or glass,
  inline stroke SVG icons, 44px touch targets, 4.5:1 contrast in both
  themes, sentence-case copy, default to no comments.
- Keep these hooks, the tests and other code depend on them:
  `data-note-id`, `data-group-id`, `data-column-id`, `data-column-index`,
  `data-spot`, `data-testid="note-content"`, `aria-current="step"`.
- The e2e suite has about 130 role and label selectors. A phase that renames
  a control updates the specs in `ui/e2e/` in the same change. The axe check
  (`a11y.spec.ts`) must keep visiting every screen in both themes.
- All motion goes through `motion/react` inside one
  `<MotionConfig reducedMotion="user">` in `main.tsx`, or CSS that the
  existing `prefers-reduced-motion` block already neutralises.
- After the last phase: regenerate `docs/screenshots`
  (`screenshots.spec.ts`), add a dated entry to `design.md`, tick the
  roadmap.

## Phase 1: theme switch

Small, and the one thing asked for by name.

**Behaviour.** Three states: system, light, dark. Stored in `localStorage`
as `thoughts.theme` (same naming as `thoughts.chime`). System removes the
attribute; the other two set `data-theme` on `<html>`.

**Build.**

- `ui/src/lib/theme.ts`: `type Theme = "system" | "light" | "dark"`,
  `readTheme()`, `setTheme(t)`, and `useTheme()` built on
  `useSyncExternalStore` (also listen to `storage` so two tabs agree, and to
  the `prefers-color-scheme` media query so "system" reports what is
  showing). `setTheme` writes storage, sets or removes the attribute, and
  sets both `<meta name="theme-color">` tags to the active paper colour
  (`#f4f6f8` or `#0e1624`).
- `ui/index.html`: a four-line inline script in `<head>`, before the module
  script, that reads the key and sets `data-theme`, so a dark-mode reload
  never flashes light. The server sends no Content-Security-Policy today, so
  inline is fine; if one is ever added, move this to `ui/public/theme.js`.
  This is the one comment worth writing in that file.
- `ui/src/components/theme-toggle.tsx`:
  - `ThemeToggle`: a 44px icon button, sun when dark is showing and moon
    when light is, `aria-label` "Switch to dark theme" / "Switch to light
    theme". One press flips to the explicit opposite of what is showing.
  - `ThemeChoice`: a three-option React Aria `ToggleButtonGroup` (System,
    Light, Dark) for the account menu built in phase 2. Until then, put
    `ThemeToggle` in the header of `_signedin.tsx` and the top right corner
    of `login.tsx`.
- Palette: make `Shortcut.keys` optional so a command can exist without a
  key (`Kbd` renders nothing, the key handler skips it). Register "Use the
  light theme", "Use the dark theme", "Match the system theme" in section
  "Anywhere". No key: nobody switches theme many times a retro.
- `index.css`: the dark token block is written twice. Leave it; CSS cannot
  share it between a media query and an attribute selector without a build
  step, and a comment already explains the pair.

**The transition.** A roller pass. Wrap the attribute change in
`document.startViewTransition` when it exists and reduced motion is off:

```css
::view-transition-old(root) { animation: none; }
::view-transition-new(root) { animation: roller 320ms cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes roller { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
```

The new stock wipes in from the left edge like ink off a roller. Without
the API it switches instantly.

**Done when.** One click switches theme from any screen including sign-in;
a reload keeps it without a flash; "System" follows the OS live; a new e2e
test covers click, reload and the palette command; `a11y.spec.ts` gains a
run with the OS light and the toggle set to dark.

## Phase 2: quieter foundations

Token and primitive changes that every later phase uses. The app should
look calmer after this phase with no layout change yet.

**Rules.** Three weights instead of one. Add to `@theme`:

| Token | Value | Use |
|---|---|---|
| `--color-line` | `color-mix(in oklch, var(--color-ink) 18%, transparent)` | dividers between rows, popover and sheet edges |
| existing ink at 2.5px | unchanged | the bar's bottom edge, focused or filled inputs, the outline button, sheets on desktop. Nothing else. |
| no rule | | lists separate with space and `line` hairlines (1.5px) |

Replace `border-[2.5px] border-ink` on list rows (`retro-list.tsx`), the
ready strip, `LastTime`, suggestion cards, toasts, popovers and menus with a
1.5px `border-line`, or nothing where spacing already separates. Inputs at
rest become 1.5px ink-soft, 2.5px ink on focus.

**Type budget.** Bagel Fat One is allowed for: the wordmark, one page title
per screen, column titles, numerals (rank, timer), and sheet titles. Move to
Familjen Grotesk bold: group titles (20px), team names, avatar initials,
`h3`s inside sheets, shortcut section names, palette section headers, form
labels that currently borrow the display face. Retro titles in lists stay
display; they are that page's content.

**Primitives** in `components/ui.ts` and a new `components/icon-button.tsx`:

- `button.solid`, `button.line`, `button.quiet` keep their names. `solid`
  gains the hover misregistration: `hover:shadow-[3px_3px_0_var(--color-pink)]`
  and `data-pressed:shadow-none data-pressed:translate-x-[3px] data-pressed:translate-y-[3px]`,
  so the button visibly presses onto its pink offset. (Arbitrary shadow
  values still work with the shadow scale cleared.) This is a hard offset
  block, not a soft shadow; say so in the `design.md` entry.
- `IconButton`: 44px square, inline stroke SVG child, required `label`,
  wrapped in a React Aria `TooltipTrigger` that shows the label and its key.
  Hover fill `blue-tint`.
- `components/icons.tsx`: one file of small stroke icons on a 20px grid,
  `stroke-[1.8]`, `currentColor`: sun, moon, clock, more, plus, check,
  target, image, pencil, trash, arrow-left, arrow-right, close, people,
  export, settings, keyboard. Draw them; no icon package.
- `Menu` wrapper: lift `QuickMenu` and `Item` out of `note.tsx` into
  `components/menu.tsx` so the account menu, board menu and note menu share
  one look.

**App shell** (`_signedin.tsx`). Header becomes: wordmark left; right, one
avatar button (initials on `blue-tint`, round) opening a menu with the
person's name, `ThemeChoice`, "Keyboard shortcuts" (`?`), "Sign out". The
loose "? shortcuts", name and "Sign out" text go. `ThemeToggle` stays
beside the avatar as the one-click route.

**Width.** The shell's `max-w-6xl` moves into the pages: home, team and tag
pages take `max-w-3xl` (a reading list does not need 1150px), the board
takes the full window with 24px gutters and columns of `minmax(18rem, 1fr)`.

**Copy fixes** while here: "1 action done" plurals in `retro-list.tsx`;
"Time's up" in ink, not pink.

**Done when.** A screenshot of home and of a board shows one heavy rule at
most, and the display face only where the budget allows. Axe passes in both
themes.

## Phase 3: the bar and the dock

The structural change. Replaces `BoardHeader`, the ready and timer strip
and the always-open `LastTime` panel.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ ◖◗  Sprint 41        Reflect ━━ Group ── Vote ── Discuss   [ Reveal and group ] ]  │
│     Payments                                                4:49   PN SO JL +2   ⋯ │
╞═════════════════════════════════════════════╤══════════════════════════════════════╡  ← timer rule, pink, shrinking
│ 2 actions still open from last time · Settle them                                  │  ← only when there are any
│                                                                                    │
│ Went well               Puzzled us              Try next                           │
│ What should we keep…    What didn't make…       One thing to change…               │
│ ▏Write a thought        ▏Write a thought        ▏Write a thought                   │
│ ┌───────────────┐       ┌───────────────┐       ░░░░░░░░  ░░░░░░░░                 │
│ │ my note       │       │ my note       │                                          │
│ └───────────────┘       └───────────────┘                                          │
│ ░░░░░░░  ░░░░░░░        ░░░░░░░                                                    │
│                                                                                    │
│                         ┌──────────────────────────┐                               │
│                         │  I'm done  D   3 of 5    │  ← dock                       │
│                         └──────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────────────────────┘
```

(One row on a wide screen; the sketch wraps it to fit this page.)

**The bar** (`components/board/bar.tsx`, sticky, `top-0`, paper background,
56px, 2.5px ink bottom edge, the only heavy rule on the page). On a board
it replaces the app header, so `_signedin.tsx` renders its header only on
routes that are not a retro. Left to right:

1. `Mark` linking home (`aria-label` "thoughts, home").
2. Title in display 24px, one line, truncated, with team and tags beneath
   in 13px ink-soft on desktop only. `<h1>` stays for the tests.
3. **Stepper** (`stepper.tsx`): an `<ol>` of the four stages joined by short
   rules. Done stages: ink-soft with a check. Current: ink block,
   `aria-current="step"`. The stage before the current one is a real button
   ("Go back to reflect") that opens the existing `StageConfirm`. Later
   stages are plain text. This removes the separate "Back to…" button.
4. **Next button**: the single `button.solid` on the page, label from
   `stages[at + 1].next`, with `Kbd ]`. Its bottom 4px is a meter of
   `ready ÷ people` in pink; when everyone is done the label gains "·
   everyone's done". Absent in discuss.
5. **Timer chip** (`timer.tsx`, logic moved from `facilitation.tsx`). Idle:
   clock `IconButton` (key `t`) opening a popover with 2, 3, 5, 10 minutes
   and the chime toggle. Running or paused: the time in display numerals as
   the popover trigger, with Pause or Resume, +1 min, Clear and the chime
   toggle inside. Four loose text buttons become one chip.
6. **Timer rule**: while a timer runs, a 3px pink bar lies over the ink
   edge, its width `remaining ÷ total` of the window, updated with the
   existing 250ms tick and a linear width transition. Total is not in the
   board frame: remember `remaining` the first time a given `endsAt` or
   `left` is seen and treat that as the total; "+1 min" just makes it wider
   again. At zero the bar goes solid ink to paper once (300ms) and the chip
   reads "Time's up".
7. **Presence**: up to five initials, then "+n". Someone who is done gets a
   12px pink stamp on the corner of their initial, so the row answers both
   "who is here" and "who are we waiting for". The tooltip lists names in
   two groups, "Done" and "Still going". The reconnecting state replaces
   this cluster with "Reconnecting…" on `alert`.
8. **More** (`IconButton`, more): Export (not in reflect), Settings,
   Keyboard shortcuts, theme, Sign out.

**The dock** (`components/board/dock.tsx`): fixed bottom centre on desktop,
full-width with `env(safe-area-inset-bottom)` on a phone; paper, 1.5px line
border, no shadow. Give the board `pb-28` so it never covers content.
Contents by stage:

| Stage | Dock |
|---|---|
| Reflect | "I'm done `D`" toggle, "3 of 5 done". On a phone, also the composer (phase 4). |
| Group | "I'm done", the count, and the AI "Suggest" button where AI is on. |
| Vote | "I'm done", and your votes as a row of stamps: filled pink for votes left, hollow for spent, `aria-label` "2 of 5 votes left". The explanatory sentence under the old header becomes this row's tooltip and a one-time toast on entering the stage. |
| Discuss | View switch "All / One at a time" with previous and next, "Follow the room" toggle, AI buttons. No ready check, as now. |

**From last time.** `LastTime` becomes a one-line strip under the bar,
shown in reflect and discuss only: "2 actions still open from last time",
then a `button.quiet` "Settle them" that opens a `Sheet` holding the
existing list. In the sheet each row keeps its three choices, as icon
buttons with tooltips (check: Done, arrow-right: Carry over, close: Drop).

**Phone.** Bar: mark, title, people count, more. Under it a four-segment
line (filled up to the current stage) with the stage name; tapping it opens
a sheet with the stepper and the next button, since the person running a
retro from a phone is rare but must not be stuck. The timer chip moves into
that row when a timer is running.

**Done when.** On 1360×900 the first note's top edge is within 260px of the
top of the window in reflect; on 375×812, within 300px. Every control that
existed before is still reachable. `[`, `]`, `t`, `d` behave as before.
`facilitation.spec.ts` and `retro.spec.ts` are updated. `task test:soak`
is not needed here: no hub or socket code changes.

## Phase 4: writing and the note card

**Composer** (`components/board/composer.tsx`) replaces "Add a thought" and
the add half of `NoteEditor`.

- Sits at the top of each column in reflect and group, directly under the
  column prompt: a single-line field with a 2.5px ink left edge, placeholder
  "Write a thought", accessible name "Add a thought to {column}". It grows
  to fit as text wraps (CSS `field-sizing: content` with a `rows` fallback).
- Enter sends `note.add` and keeps focus in the cleared field, so five
  thoughts are five Enters. Shift+Enter is a new line. Escape blurs. The
  500 character limit stays; show "480 / 500" only past 400.
- In reflect, the first time it is focused in a retro, a line under it:
  "Nobody else can read this until grouping." Then it goes.
- Keys: `n` focuses the composer of the column last written in (the first
  by default), section "Retro", label "Write a thought". `1` to `5` focus
  that column's composer; register them `hidden` plus one visible entry in
  the `?` sheet. This is the action people reach for most, so it earns keys.
- New notes go to the top of your own list under the composer, so what you
  just wrote is next to where you wrote it. Check what order the server
  returns; if it appends, leave the order alone and scroll the new note
  into view instead.
- Phone: one composer, in the dock, adding to whichever column is snapped
  into view. Above the columns a row of column names acts as tabs: tap to
  scroll there, and the snapped one is underlined (IntersectionObserver on
  the sections). The dock field's placeholder names the column: "Add to
  Went well".

**Editing in place.** Pressing Edit, or Enter on a focused own note, turns
the card's text into the same field, same keys. Image and GIF picking stays
in a `Sheet` (it needs the room), opened from the image icon on the card
being edited. `note.add` takes no image, so a new thought still gets its
image through edit, as today.

**The card** (`note.tsx`).

- The "…" button shows at 40% on touch devices and only on hover or
  focus-within on fine pointers (`pointer-fine:opacity-0
  group-hover/note:opacity-100 group-focus-within/note:opacity-100`). It is
  always in the tab order.
- Author: 13px, ink-soft, bottom left. "You" stays bold.
- Images: 1.5px line border, `max-h-56`, as now.
- Delete keeps its undo toast.

**Done when.** A thought can be added without the pointer: `n`, type,
Enter, type, Enter. No modal opens to add or edit text. Axe passes with a
composer focused. `a11y.spec.ts`, `retro.spec.ts` and `smoke.spec.ts` are
updated for the new names.

## Phase 5: grouping and voting

**Pick up, put down.** A second way to group that works with a finger, a
mouse or keys, next to drag and drop:

- In group stage, pressing a note (or Space on a focused note) picks it up:
  it tilts 2 degrees and lifts 4px on a pink offset, every other pile and
  every column shows a dashed pink outline, and the dock says "Moving
  '{first words}…' · tap a group or a column · Esc to put it back".
- Pressing a pile sends `note.move` with `groupId`; pressing a column's
  empty area or its "On its own here" slot sends it with `columnId`. Escape
  or pressing the note again cancels.
- State is `picked: string | null` in the board context beside `dragging`;
  the drop targets already exist in `columns.tsx` and can share their
  handlers.
- Drag and drop stays for desktop. "Move to…" stays in the menu as the
  search route for big boards.

**Group names.** A pile of two or more shows its name in grotesk bold above
it, or a quiet "Name this group" that becomes a field on press, as now but
without the display face.

**Voting.** Remove the "Vote" button and "Take one back" text.

- Each pile in vote stage gets one **stamp slot** at its bottom right: a
  44px dashed circle with a plus, `aria-label` "Vote for {group name or
  first note}". Pressing it sends `vote.cast` +1 and a pink stamp lands
  beside it (they overlap by 40% and overprint, as `Stamps` does now).
- Pressing one of your stamps takes it back (`aria-label` "Take back a vote
  from {group}"). On hover it shows a minus.
- With no votes left, slots go to 40% and the dock's stamp row gives a
  short shake when one is pressed.
- Totals stay hidden until discuss; that is the server's rule and it holds.

**Done when.** A retro can be grouped on a phone without opening a menu.
Voting is one press per vote, and the page shows no "Vote" text buttons.
`drag.spec.ts` still passes and gains a pick-up-put-down case on the phone
project.

## Phase 6: discussion

- **Ranks.** Groups with at least one vote keep the large numeral. The rest
  sit under one hairline headed "No votes", in column order, with no
  numeral and at normal size.
- **Spotlight.** "Bring everyone here" under every group becomes a target
  `IconButton` in the group's header row, tooltip "Bring everyone here".
  The spotlit group keeps the `blue-tint` ground and its "Everyone's here"
  tag, which gains a close icon ("Let everyone move on").
- **Reactions** stay as they are; the add button uses the shared `Menu`.
- **Actions panel.** Keeps its `pink-tint` ground; it is the one coloured
  panel on the page and should be. The add form becomes one always-present
  field at the top, "Add an action" (`a` focuses it), Enter adds with no
  owner or date. A new row shows "Who" and "By" as two quiet inline
  buttons that turn into fields, so the fast path is one line and the full
  path is still there. Edit turns the row into the same fields in place.
  Done actions collapse under "Done (3)".
- **Recap** moves to the top of the actions panel, under the heading.
- **Phone.** The panel becomes a bottom sheet with a tab in the dock,
  "Actions (2)", so it is one tap away while reading groups.

**Done when.** With five groups and two voted, the page shows two numerals.
There is no repeated text button under each group. An action can be added
with `a`, type, Enter.

## Phase 7: home, team pages and starting a retro

**Home** (`_signedin.index.tsx`, `retro-list.tsx`, `teams.tsx`).

```
thoughts                                                    ☾  (EG)

Retros                                              [ New retro  C ]

All   Payments · 2 to do   Platform   + New team

IN PROGRESS
Sprint 41                                             ■■□□  Group
Payments · 12 thoughts · today

EARLIER
Sprint 40                                             ■■■■
2 of 2 actions done · 29 Oct
```

- One display heading, "Retros". The "Teams" and "Recent retros" headings
  go.
- Teams become one row of links under the heading (grotesk bold, the open
  action count in ink-soft), ending in "New team". They still go to
  `/t/{slug}`. The explanatory sentence shows only when there are none.
- The list splits in two with small caps labels: "In progress" (stage is
  not discuss) and "Earlier". Rows separate with hairlines.
- A row is two lines: title in display 24px; then one ink-soft line built
  from the parts that apply: team or tags, "12 thoughts", "1 of 2 actions
  done", date ("today", "yesterday", then the date). At the right, a
  four-square stage glyph filled to the current stage, with the stage name
  beside it for in-progress rows and for screen readers always.
- Hover and focus: the row shifts 4px right and the title picks up the
  wordmark's misregistration (a pink copy 0.045em off, `aria-hidden`). No
  background fill.
- Team and tag pages take the same row and the same single-heading layout.
  Their "Still to do" panel keeps `pink-tint`.

**New retro** (`create-retro.tsx`). Two keystrokes to a board:

- Opens with the title field focused and the first template chosen. Enter
  starts the retro.
- Templates become a grid of small previews: the template's column titles
  set as two to four little ink bars with labels, name beneath. Pressing
  one selects it. This shows what you get instead of making people parse
  "Went well, puzzled us, try next" as a chip.
- "Change the columns" is a disclosure holding the existing editor, opened
  automatically if an AI theme produced the columns.
- "Team, tags and visibility" is a second disclosure. Team is preselected
  from a team page, tags from a tag page, as now.
- The AI theme box sits under the template grid as one line, where AI is
  on.

**Settings** (`header.tsx`'s `Settings`, move to `settings.tsx`). Two
sections with grotesk headings, "This retro" and "Columns". Column title
and prompt save on blur or Enter (`column.update`), with a toast on
failure, so the per-row Save button goes. The form's Save stays for the
retro fields.

**Sign-in.** Leave it. It is the calmest screen in the app. Only the
`ThemeToggle` from phase 1 is added.

**Done when.** Home shows one display heading. A retro can be started with
`c`, a title, Enter. The plural bug is gone.

## Phase 8: motion

Add after the structure has settled, so animations are written once.

**Setup.** `main.tsx` wraps the app in `<MotionConfig reducedMotion="user"
transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>`. Import from
`motion/react`. Tokens in `components/motion.ts`:

| Name | Value | Use |
|---|---|---|
| `quick` | 120ms ease-out | hover, press, menu open |
| `enter` | 180ms ease-out | things appearing or leaving |
| `move` | spring, stiffness 520, damping 38, mass 0.8 | notes and piles changing place |
| `thud` | spring, stiffness 700, damping 22 | stamps |
| `pass` | 700ms in total | the stage band |

Nothing waits on an animation: input is live from the first frame.

**The catalogue**, in the order to build it:

1. **Notes glide.** `NoteCard`'s root becomes `motion.article` with
   `layout="position"` and `layoutId={note.id}`, inside a `LayoutGroup`
   around the board. When a frame moves a note to another pile or column,
   it travels there instead of jumping. Piles get `layout` so they make
   room. This one change covers other people's grouping, your own drops,
   and ungrouping. `useDrag` passes its handlers as props; spread them on
   the motion element and check drag still starts (motion defines its own
   `onDragStart` prop type, so the HTML handlers may need to go on an inner
   element).
2. **Notes arrive and leave.** `AnimatePresence` per column. Enter: a
   printed reveal, `clip-path` from `inset(0 0 100% 0)` to `inset(0)` over
   `enter`. Exit: opacity to 0 and scale to 0.96 over `quick`. Read the
   existing note in `CLAUDE.md` about `popLayout` and refs before choosing
   an `AnimatePresence` mode; `mode="sync"` avoids it.
3. **The reveal.** The signature moment. `HiddenNote` gets the same
   `layoutId` as the note it stands for (hidden notes carry ids). When
   reflect becomes group, each halftone block grows into its card while the
   dots develop into flat ink: animate the dot layer's `background-size`
   from 9px to 3px and its opacity to 0 over 260ms, staggered 30ms a note,
   capped so the whole board finishes inside 600ms.
4. **The stage band.** When `board.retro.stage` changes after the first
   frame, a full-width ink band slides across under the bar, carrying the
   new stage name in display type, and off the other side: 250ms in, 200ms
   hold, 250ms out, `pointer-events: none`, `aria-hidden` (announce the
   stage through the existing live region instead). Everyone sees it,
   because the change came from the server; it answers "what just
   happened" for the people who did not press the button. Going back runs
   it right to left.
5. **Stamps.** A vote lands with `thud`: scale 1.5 to 1 from a rotation
   picked per stamp between −12 and 12 degrees, and the pile dips 1px. A
   vote taken back lifts: scale to 1.2, opacity to 0, `quick`. In discuss,
   totals land one after another, 40ms apart.
6. **Into discussion.** With `layoutId` on piles, switching `Columns` for
   `Discuss` makes each pile travel from its column to its rank. Numerals
   fade up after the piles settle.
7. **Spotlight.** The `blue-tint` ground behind the spotlit group is one
   element with `layoutId="spot"`, so it slides from the old group to the
   new one while the page scrolls there.
8. **Pick up.** The picked note's tilt and lift use `move`; targets'
   dashed outlines fade in over `quick`.
9. **Presence.** Initials slide in from the right and close up when
   someone leaves (`layout` on the row). The done stamp lands with `thud`.
10. **Sheets and menus.** Keep the `rise` and `fade` keyframes. Add exits:
    React Aria sets `data-exiting`; give it the reverse at 120ms. On a
    phone sheets rise from the bottom edge the full height.
11. **Pages.** `defaultViewTransition: true` on the router (the installed
    router-core has it). Give a retro row's title and the board's `<h1>`
    the same `view-transition-name` (`retro-${id}`) so the title travels
    from the list into the bar. Everything else crossfades at 150ms.

**Guard rails.** With more than 120 notes on the board, turn off `layout`
on notes (plain swaps are better than a slow page). Do not animate while
`document.hidden`. No infinite animations except the existing AI scribble.

**Done when.** With two browsers side by side, a note written, moved or
grouped in one visibly travels in the other. The reveal and the stage band
run on both. With "reduce motion" on, every change is instant and nothing
is lost. Run `task test:soak` once at the end as a smoke check even though
no server code changed, and run the e2e suite three times in a row: layout
animation is a classic source of flaky clicks. If a test clicks something
mid-flight, wait for it in the test rather than removing the animation.

## Phase 9, optional: instant sends

Today every action waits for the server's `ack` and board frame before the
page changes. On a local network that is invisible; on a slow link it is
the difference between snappy and not.

- Keep an overlay of pending changes in `board.tsx`: notes just written
  (shown at 60% until the next frame), votes just cast, your own ready
  state, your own reactions.
- Apply the overlay on top of the last server board when building the
  context value. Drop an entry when its command settles: the frame that
  follows an `ack` already contains the real thing; an `error` gets the
  existing toast and the entry disappears.
- Only these four. Moves, grouping, stage changes and anything that
  touches other people's view wait for the server, so two people never see
  different boards for long.

Do this last and only if it stays small. If the overlay starts needing to
know the server's rules, stop.

## What this does not change

- The inks, the typefaces, overprint as the mark of grouped notes.
- Any URL, command, frame, or what each person may see at each stage.
- Anyone in the room can still move the stage; there is no facilitator
  role.
- The key set, apart from adding `n` and `1` to `5`.
