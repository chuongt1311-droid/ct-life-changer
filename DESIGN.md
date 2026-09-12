---
name: Life Changer — Performance Department
description: A night-pitch readiness desk where the next session is the biggest thing on screen and gold is spent once.
colors:
  pitch-900: "#0B1016"
  pitch-800: "#101822"
  pitch-700: "#131C26"
  pitch-600: "#1A2530"
  line: "#24313E"
  line-soft: "#1B2531"
  ink: "#E8EEF2"
  ink-2: "#A9BCCB"
  ink-3: "#7D91A1"
  ink-done: "#90A4B4"
  strike: "#5B7183"
  strike-2: "#46596A"
  white: "#FFFFFF"
  gold: "#F5C542"
  gold-dim: "#8A6E1E"
  read-ok: "#3DDC84"
  read-warn: "#FFB020"
  read-stop: "#FF4D5E"
  phase-first-light: "#16202B"
  phase-day: "#131C26"
  phase-dusk: "#18202C"
  phase-night: "#0B1016"
  tier-bronze: "#C77B42"
  tier-bronze-ink: "#C99368"
  tier-silver: "#D6E2EA"
  tier-silver-ink: "#C6D4DE"
  tier-ground-bronze: "#3A2517"
  tier-ground-silver: "#2E3A44"
  tier-ground-gold: "#3B3013"
  tier-ground-hof: "#4A3B14"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 15vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.88
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  numeral:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  subtitle:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "Barlow, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-small:
    fontFamily: "Barlow, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.11em"
  caption-passage:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.04em"
rounded:
  hairline: "1px"
  tag: "2px"
  sm: "3px"
  card: "6px"
  disc: "50%"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  s8: "64px"
components:
  button:
    backgroundColor: "{colors.pitch-700}"
    textColor: "{colors.ink}"
    typography: "{typography.subtitle}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "52px"
  button-hover:
    backgroundColor: "{colors.pitch-600}"
  button-main:
    backgroundColor: "{colors.gold}"
    borderColorless: "transparent"
    textColor: "#17120A"
    typography: "{typography.subtitle}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "52px"
  button-main-hover:
    backgroundColor: "#FFD661"
    textColor: "#17120A"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "52px"
  tag-ready:
    textColor: "{colors.read-ok}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 12px 2px"
  tag-drifting:
    textColor: "{colors.read-warn}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 12px 2px"
  tag-depleted:
    textColor: "{colors.read-stop}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 12px 2px"
  tag-neutral:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 12px 2px"
  cardstrip:
    backgroundColor: "{colors.pitch-700}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 16px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.subtitle}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  chip-checked:
    backgroundColor: "{colors.pitch-600}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.pitch-800}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px"
    height: "52px"
  placard:
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
  placard-synthetic:
    textColor: "{colors.ink-3}"
    typography: "{typography.caption-passage}"
  attr-levelled:
    backgroundColor: "rgba(245, 197, 66, 0.05)"
    textColor: "{colors.gold}"
    rounded: "{rounded.sm}"
    padding: "12px 11px"
---

# Design System: Life Changer — Performance Department

## Overview

**Creative North Star: "The Night-Pitch Readiness Desk"**

This is a club's performance department, not a game menu. The screen is a dark desk under floodlight: night-pitch navy ground, cool white ink, and department small-print set in condensed uppercase. The single most important thing — the next session — is printed enormous at the top of the page, and everything below it visibly steps back in brightness. Rank is expressed as luminance, not as boxes: a session happening now is pure white, the next ones are full ink, the finished ones fade to a muted slate with a struck-through label.

Density is dashboard-tight but never cramped. A 4px spacing base, hairline rules, and a 430px mobile shell keep the page reading like a printed readiness sheet rather than a card wall. Almost nothing is a container; sections are separated by a placard heading with a rule trailing off to the right edge, so the page is a sequence of stamped sections rather than a stack of tiles. Only two things are allowed to be objects with an edge: the player card strip and the badge medallions. That scarcity is what makes them read as the club's property.

Colour is rationed on purpose. One gold carries the player card and the single main action of each screen; green, amber and red are readings, never decoration — they only ever describe readiness, load, or the direction of a change. The world explicitly refuses the EA FC main menu, where the card is the product and the day is a submenu: here the day is the product and the card is a one-row strip you can walk past.

**Key Characteristics:**
- Night-pitch navy ground with cool-white ink; dark is the scene, not a theme toggle.
- One gold, spent exactly once per screen.
- Green / amber / red are readings only; they never decorate.
- Hierarchy is brightness, not enclosure.
- Condensed display face for everything the department stamps; a humanist body face for everything it says.
- Tabular numerals everywhere a number can change under the eye.

## Colors

A four-step navy ground, a cool-white ink ramp that runs five steps down into completed work, one reserved gold, a three-colour reading set, and a closed set of medallion tier metals — nothing else is allowed on screen.

### Primary
- **Floodlit Gold** (`{colors.gold}`): The club's one accent. It carries the player card strip's lit border and OVR number, the single main action button on every screen, an attribute row that levelled up (its plate edge, wash, value and fill), gold and Hall-of-Fame medallion edges, the focus ring, the text selection highlight, and the caret. Nothing else.
- **Banked Gold** (`{colors.gold-dim}`): Gold at rest — the card strip's 2px frame before hover, the edge of a levelled-up attribute plate, and the quote rail on department messages in the mentor thread. Present but not lit.

### Secondary — the readings
- **Ready Green** (`{colors.read-ok}`): Guard state `ready`; load within plan; a `kept` change mark; a rising form arrow.
- **Drifting Amber** (`{colors.read-warn}`): Guard state `drifting`; load over plan; `moved` and `shorter` change marks; a falling form arrow. Amber — not red — is the falling-form colour, because a fall is a reading, not a failure.
- **Stop Red** (`{colors.read-stop}`): Guard states `depleted` and `grinding`; an overloaded bar; a `dropped` change mark.

### Neutral
- **Night Pitch** (`{colors.pitch-900}`): The page ground and the deepest phase tint.
- **Desk Navy** (`{colors.pitch-800}`): Input and textarea wells — a field is a hole in the desk, not a raised box.
- **Department Slate** (`{colors.pitch-700}`): Secondary buttons, medallion discs, the CT-side message bubble.
- **Raised Slate** (`{colors.pitch-600}`): The hover and checked step above slate.
- **Hairline** (`{colors.line}`) and **Soft Hairline** (`{colors.line-soft}`): Soft hairline divides sections and rows; hairline outlines components.
- **Floodlight White** (`{colors.white}`): The top of the brightness ramp, brighter than Cool White and reserved for exactly two things: the next-session headline and a session ranked `now`. It is a rank, not a text colour — nothing else on any screen may take it.
- **Cool White** (`{colors.ink}`): Primary text.
- **Readable Slate** (`{colors.ink-2}`, 7.1:1 on the ground) and **Quiet Slate** (`{colors.ink-3}`, 4.6:1): Supporting prose and small print. Quiet Slate is the floor for *live* text; nothing dimmer carries a reading.
- **Done Slate** (`{colors.ink-done}`): A completed session row. Dimmer in rank than Cool White and clear of the 4.5:1 floor — finished work steps back without leaving the readable band.
- **Strike** (`{colors.strike}`) and **Superseded Strike** (`{colors.strike-2}`): The strikethrough rule itself — Strike over a completed session name, Superseded Strike over a replaced value in the Day changed diff. The rule is always dimmer than the text it crosses, so the word stays readable through it.

### Tertiary — medallion tier metals
A closed four-tier set, used only on badge medallions and never as UI colour.
- **Bronze** (`{colors.tier-bronze}` ring, `{colors.tier-bronze-ink}` caption) over a `{colors.tier-ground-bronze}` radial ground.
- **Silver** (`{colors.tier-silver}` ring, `{colors.tier-silver-ink}` caption) over `{colors.tier-ground-silver}`.
- **Gold** — the one gold, on a `{colors.tier-ground-gold}` radial ground.
- **Hall of Fame** — the one gold, on a `{colors.tier-ground-hof}` vertical gradient.

### Day phases
Four ground tints — `{colors.phase-first-light}`, `{colors.phase-day}`, `{colors.phase-dusk}`, `{colors.phase-night}` — set on `body` from `.shell[data-phase]` and crossfaded over 900ms.

### Named Rules
**The One Gold Rule.** Exactly one gold action per screen, and only the player card may wear gold otherwise. If a screen wants two gold buttons, one of them is not the main action.

**The Brightness-Is-Rank Rule.** Ink value encodes rank, not decoration: Floodlight White for now, Cool White for next, Readable Slate for supporting, Done Slate for finished. A row never changes hue to show status — it changes brightness, and the readings colour only the tag beside it.

**The Readings-Only Rule.** Green, amber and red report readiness, load, or the direction of a change. They never mark a category, a brand moment, or a decorative edge. A colour that is not reporting a state must be navy, ink, or gold.

**The Tier-Metals-Are-Medallions-Only Rule.** Bronze and silver exist solely as medallion edge and caption material. They are not a second and third accent; a bronze button or a silver heading is outside the world.

**The Labelled Phase Rule.** The day phase is always written in words in the header placard ("Dusk · Day 12"), and the ground tint only ever follows that label. Colour alone never announces the time of day.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, system-ui)
**Body Font:** Barlow (with system-ui, -apple-system)

**Character:** A condensed grotesk does all the department's stamping — headlines, numbers, buttons, placards, table columns — while its normal-width sibling does all the speaking. The pairing keeps the page dense and signage-like without becoming a scoreboard, because the moment the app explains itself it switches into prose.

### Hierarchy
- **Display** (`{typography.display}`): The next-session name and the OVR number. One per screen, top third, the brightest element on the page. A second display step (`clamp(2.25rem, 9vw, 3rem)`, line-height 0.95) carries sheet titles on Day changed, Check-in and Re-entry.
- **Headline** (`{typography.headline}`): The when-line under the display — countdown and time window — with an uppercase Quiet Slate lead-in at 1.125rem.
- **Numeral** (`{typography.numeral}`): One step above Headline and below the hero clamp (2.5rem, weight 700, tabular): the OVR figure on the player card strip. It exists so a two-digit rating can be the loudest thing in a one-row object without borrowing the display size.
- **Title** (`{typography.title}`): Attribute values on the player card, ramp-step names on Re-entry.
- **Subtitle** (`{typography.subtitle}`): The workhorse row voice — load-bar names, session times and names, diff row names, field labels, chips, and button text (uppercase, 0.04em).
- **Body** / **Body Small** (`{typography.body}`, `{typography.body-small}`): Everything the department says in sentences. Measure is always capped: 48ch for the synthetic placard, 52ch for sheet subheads and hints, 56ch for ramp notes, 58ch for stepped-back notes, 68ch in the mentor thread.
- **Label** (`{typography.label}`): Placards, tags, nav links, medallion counts. Always uppercase at 0.11em tracking, usually Quiet Slate.
- **Caption Passage** (`{typography.caption-passage}`): Caption size in the condensed face but sentence case at 0.04em, at a 48ch measure — the synthetic-data placard and any other caption long enough to be read as a sentence.

### Named Rules
**The Stamp-and-Speak Rule.** Condensed for anything the department stamps (numbers, names, labels, controls); normal-width Barlow for anything it says. A paragraph set in the condensed face is a bug.

**The Steady Numeral Rule.** Every number that can change under the eye — countdowns, clocks, OVR, attribute values, bar values — is set in tabular numerals. A countdown must never shuffle width while it is being read.

**The Label-Or-Passage Rule.** Uppercase at 0.11em is for a stamp of a few words. Anything long enough to be read as a sentence — the synthetic-data placard runs 34 characters — drops to sentence case at 0.04em. Uppercase is a label treatment, never a way to make prose look official.

**The One Enormous Thing Rule.** Exactly one display-size element per screen, in the top third. Everything below it tops out at 2rem.

## Layout

Mobile-first, designed at 390px. A single centred shell (`max-width: 430px`) with 16px side padding and a tall bottom pad (64px + 48px) so the sticky thumb bar never covers the last row. Vertical rhythm runs on a 4px base (4/8/12/16/24/32/48/64); section headings take 32px above and 12px below.

Each screen reads top-down in three zones: the header placard strip, the next-session block (closed below by a soft hairline), then everything else inside a `.stepback` wrapper held at `opacity: 0.92` so the demotion is literal rather than implied.

At **≥900px** the shell widens to 1040px with 32px side padding and the stepback region becomes `.desk`: a two-column grid (`1fr 1fr`, 48px column gap, `align-items: start`). The next-session block stays in column one at full width; a `.col-b` child is pinned to column two and spans the full row set, so the day's session list sits beside the load bars instead of below them. This is a desk, not a stretched phone.

Actions live in a sticky bottom bar bled to the shell edges: two equal columns by default (main action left, secondary right), `.stacked` for a single full-width action, padded with `env(safe-area-inset-bottom)`. Its background is a transparent-to-ground gradient, so content dissolves under it rather than being cut off by a bar edge.

**The Thumb-Zone Rule.** Every screen's committing action sits in the sticky bottom bar at a minimum 52px target. No primary action lives above the fold only.

## Elevation & Depth

Mostly tonal. Depth comes from the navy ramp (ground → 800 → 700 → 600) and hairlines; most of the page is flat and unshadowed. Shadows appear on exactly three things: the player card strip, the badge medallions, and the one gold action — the elements meant to sit proud of the desk as objects.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 6px 18px -6px rgba(0, 0, 0, 0.65)`): The gold main action and medallion discs.
- **Card Lift** (`box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.8)`): The player card strip only.
- Gold and Hall-of-Fame medallions add an inset gold hairline (`inset 0 0 0 1px rgba(245,197,66,0.35)` and `inset 0 0 0 2px rgba(245,197,66,0.5)`) as tier material, layered on top of Lift.

### Named Rules
**The Offset-Never-Halo Rule.** Every shadow has a downward offset, a soft blur, and a negative spread. A zero-offset glow ringing an element is not part of this world.

**The Two Objects Rule.** Only the card strip and the medallions are objects. Sections, rows, bars and lists are printed on the desk and carry no shadow.

## Shapes

Department paperwork, not app tiles. Four radii, each with a job: a barely-there 3px (`{rounded.sm}`) on buttons, chips, fields and the levelled-up attribute plate; 6px (`{rounded.card}`) on the two object materials; 2px (`{rounded.tag}`) on tags; and a 1px hairline radius (`{rounded.hairline}`) on every progress track and fill — just enough to take the mechanical bite off a 4–6px bar without making it a capsule. Medallion discs and status pips are full circles. Nothing is pill-shaped.

Borders are 1px hairlines by default, and border weight is reserved for the things that are objects. Three exceptions carry meaning: the player card strip's **2px banked-gold frame**, heavy enough to hold its own edge under a 30px shadow rather than reading as a hairline; the medallion disc's 4px tier ring; and the 1px banked-gold quote rail on department messages. The one gold action goes the other way — it carries no border at all (`border-color: transparent`), because a gold fill is already its own edge and a border on it would only outline the fill.

An attribute that levelled up is an **edged plate**: a 1px banked-gold border, 3px radius, a 5%-alpha gold wash, and negative inline margin (-12px) with its own 12px/11px padding so the plate bleeds past the text column and the type never shifts. It reads as a stamped-out row, not a margin mark.

Progress is always a flat track (6px for load, 4px for attributes) with a hairline-radius fill — a printed bar, not a capsule. Overload wears a diagonal zebra, held as the `--zebra` material (`repeating-linear-gradient(-45deg, rgba(11,16,22,0.55) 0 5px, transparent 5px 11px)`), laid over the red load fill and over a `grinding` tag. The stripes are a named material of this world, not texture: they mean overload and nothing else.

**The Zebra-Means-Overload Rule.** The diagonal stripe is the single overload material. It appears only on a load fill at or over 100% and on the `grinding` tag. It is never a background pattern, a loading state, or a decorative panel.

## Components

### Buttons
- **Shape:** Nearly square corners (3px), 52px minimum height, uppercase condensed at 0.04em tracking.
- **Main:** Gold fill with a transparent border, near-black text (`#17120A`), weight 700, Lift shadow. The fill is the edge; no outline. One per screen; a wide variant spans both thumb columns.
- **Default:** Department Slate fill, hairline border, cool-white text.
- **Quiet:** Transparent with Readable Slate text; fills to Department Slate on hover.
- **States:** Hover steps the ground one rung up the navy ramp (or to `#FFD661` for gold) over 180ms; active presses down 1px; disabled drops to 0.42 opacity with pointer events off. Focus is the global 2px gold outline at 2px offset.

### Tags (readiness)
- **Style:** Uppercase label type in the reading colour, on an 8%-alpha wash of that colour with a 45%-alpha border, 2px radius.
- **States:** `ready` / `drifting` / `depleted` / `grinding` / `neutral` via a data attribute. `grinding` is the only tag that adds the zebra ground — an overload state should look damaged. `neutral` drops all colour to Readable Slate on a plain hairline and carries non-reading labels like "Next" or "Anchor".

### Chips (check-in)
- **Style:** A visually hidden input with a styled sibling: hairline border, 3px radius, Readable Slate condensed text.
- **State:** Checked lifts to Raised Slate with a Readable Slate border and cool-white text. No accent colour — a check-in answer is not a reading.

### Inputs / Fields
- **Style:** Recessed Desk Navy well, hairline border, 3px radius, 52px minimum height, body face, vertical resize only.
- **Focus:** Border shifts to gold, alongside the global gold focus ring. Placeholders sit at Quiet Slate.
- **Skip:** A field group may carry a quiet underlined skip control that empties the group rather than hiding it and relabels itself "Skipped — undo". A skipped section still counts and stays reachable.

### Navigation
- **Style:** A flat wrap of uppercase label-type links above the thumb bar, separated from content by a soft hairline. Quiet Slate at rest, cool white on hover, cool white with a 2px underline for the current page. No icons, no bar, no chrome.

### Player Card Strip (signature)
One row — the OVR numeral at 2.5rem in gold, a form arrow with a worded label, a readiness tag — on a subtle vertical navy gradient inside a 2px banked-gold frame, 6px radius and Card Lift. The frame is the only 2px border in the system; it gives the strip a physical edge instead of a hairline drowning under a 30px shadow. As a link it brightens its border to full gold and lifts 1px. It animates in once on load. It is the only place the whole player is represented, and it is deliberately one row tall.

### Load Bars (signature)
A stack of readings: name and value on a baseline row, a full-width track beneath. Fill colour is the reading — Quiet Slate when neutral, green within plan, amber over plan, red plus zebra when overloaded. The value is always written in words as well as drawn ("4h 10m · 40m over plan").

### Badge Medallions (signature)
A three-column grid of 68px circular discs with a 4px tier ring and a top-lit radial interior: bronze `#C77B42`, silver `#D6E2EA`, gold, and Hall of Fame (a full vertical gold-to-navy gradient with a 2px inset ring). An unearned badge is still shown, unlit: soft-hairline ring, Quiet Slate icon, no shadow. Each disc holds a 26px stroked icon; name and cumulative count sit beneath in condensed type.

### Session List / Diff Rows
Rows divided by soft hairlines on a three-column grid (time, name with a body-face sub-line, tag). Rank drives brightness: `now` is Floodlight White and bold, `next` is Cool White, `done` drops to Done Slate with the name struck through in Strike. A whole-title link inside a row inherits the row's rank colour rather than taking a link colour. Diff rows use `moved` / `shorter` / `dropped` / `kept` to colour a 20px stroked mark and strike the superseded value in Superseded Strike.

### Attribute Rows (signature)
Name, value, a 4px hairline-radius track, and a to-next line. A row that levelled up becomes an edged gold plate (see Shapes): gold value, gold fill, gold to-next line, and a one-time 1.6s gold wash. Every other row stays printed flat on the desk.

### Synthetic-Data Placard
Every screen ends with a rule and a sentence-case caption in the condensed face at 0.04em, Quiet Slate, capped at 48ch, naming the screen's numbers as a synthetic demo day. It is a passage, not a label, and is set accordingly.

### Motion
One easing curve throughout (`cubic-bezier(0.16, 1, 0.3, 1)`): 120–220ms for control states, 900ms for the phase-tint crossfade. There are exactly two authored moments: the card strip settling in on load (620ms fade, 10px rise, 6px blur clearing) and a 1.6s gold wash across an attribute row that levelled up. `prefers-reduced-motion: reduce` collapses everything to 0.01ms.

### Icons
An authored inline SVG sprite of 24×24 symbols, duplicated inline into each page so references resolve with no external fetch. Every icon is stroked at 1.75 (1.6 on medallions), round caps and joins, no fill, sized in `em` and coloured by `currentColor`. New icons are drawn into the sprite in that same stroke language.

## Do's and Don'ts

### Do:
- **Do** put one enormous display element in the top third of every screen and demote everything after it with the stepback wrapper (opacity 0.92).
- **Do** spend the gold exactly once per screen, on the single main action — plus the player card, which owns gold by right.
- **Do** write the reading in words beside every bar, tag and arrow ("40m over plan", "Good form", "Drifting"). Colour is the second channel, never the only one.
- **Do** set every changing number in tabular numerals.
- **Do** keep the committing action in the sticky thumb bar at 52px minimum, two columns or stacked.
- **Do** label the day phase in text in the header placard whenever the ground is tinted.
- **Do** draw new icons into the inline sprite at 24×24, 1.75 stroke, round caps, no fill.
- **Do** mark any screen carrying demo numbers with the synthetic-data footer rule, set sentence case at 0.04em.
- **Do** use the brightness ramp for rank — Floodlight White, Cool White, Readable Slate, Done Slate — and strike completed or superseded text with a rule dimmer than the text it crosses.
- **Do** reach for the zebra material whenever, and only when, something is over its load.
- **Do** give the card strip its 2px frame and let the gold action's fill be its own edge.

### Don't:
- **Don't** use green, amber or red for anything that is not a readiness, load, or change reading.
- **Don't** introduce a second accent, a brand gradient wash, or any gold other than `{colors.gold}`.
- **Don't** put a zero-offset glow on anything, or shadow an element outside the card strip, the medallions and the gold action; shadows here are offset plus blur plus negative spread.
- **Don't** set prose in the condensed face, or a label or number in the body face.
- **Don't** wrap sections in bordered cards. Use a placard heading with its trailing rule; only the card strip and medallions are objects.
- **Don't** carry text below the 4.5:1 floor on the ground; Quiet Slate and Done Slate are the dimmest inks in the system and nothing dimmer than them carries words. Strike and Superseded Strike are rules, not text colours.
- **Don't** spend bronze or silver anywhere but a medallion edge or its caption, and don't put Floodlight White on anything but the next-session headline or a `now` row.
- **Don't** use the zebra stripe as decoration, or put a border on the gold action.
- **Don't** write shame language, streak counts, or "days in a row" anywhere. Badges count cumulative totals, attributes and badges never fall, and the copy must never imply otherwise.
- **Don't** frame rest as a loss. Resting while depleted earns double and the screen says so; grinding while depleted earns zero training XP and is labelled "Injury risk", never "wasted".
- **Don't** use pill radii, glyph or emoji icons, system display faces, or kicker/eyebrow labels above headlines.
- **Don't** present prototype numbers as product truth; every value on these screens is a labelled synthetic demo day.
