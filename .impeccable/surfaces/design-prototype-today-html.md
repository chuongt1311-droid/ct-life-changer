---
version: 1
slug: "design-prototype-today-html"
primary_target: "design/prototype/today.html"
related_targets: ["design/prototype/day-changed.html","design/prototype/reentry.html","design/prototype/checkin.html","design/prototype/mentor.html","design/prototype/card.html"]
---

# Surface brief: Daily Loop core screens (prototype)

**Scope:** static prototype screens that set the visual reference for Plan 5: Today (`today.html`), Day changed sheet (`day-changed.html`), Re-entry ramp (`reentry.html`), Evening check-in (`checkin.html`), Mentor (`mentor.html`), Player card and badges (`card.html`), with shared tokens in `tokens.css`. Mobile-first at 390 px; must also hold on a laptop.

**Mode:** Operate.

**Task:** glance at what's next, handle a disruption in seconds, come back after rest, log the day with one thumb, read the mentor, check where the career stands.

**Confirmed:** "Next up" must be readable in one glance, even half-awake. The evening happens in a dark room. Career-mode progression is CT's explicit choice (2026-09-11) under PRODUCT.md's guardrails: attributes and badges never fall, badges count totals and never streaks, rest earns, grinding while depleted earns nothing.

**Memorable moment:** the player card strip settles into place under Next up, and a level-up lifts one attribute row with its gold tier edge while everything else stays still.

**Unresolved:** mentor language (English inferred); real content replaces the synthetic demo day in Plan 5.

## Direction contract

THESIS: CT is the player; the app is the club's performance department, and it puts them on the pitch only when the readings say they are ready. Refuses the EA FC main menu where the card is the product and the day is a submenu.

OWN-WORLD: Night-pitch navy grounds (#0B1016, #131C26) under cool white #E8EEF2; one gold #F5C542 reserved for the player card and the single main action; green/amber/red #3DDC84 #FFB020 #FF4D5E only as readiness readings. Materials: session load bars, a compact player card strip with OVR and a form arrow, badge medallions with tier edges, diagonal zebra stripes for overload. Barlow Condensed carries display and captions; Barlow carries prose. Labelled day phases (first light, day, dusk, night) tint the ground, never colour alone.

STORY: CT reads the next session and their readiness in one look, believes the department is protecting them rather than pushing them, and starts the session or starts rest.

FIRST VIEWPORT: Next session enormous at the top third — name, phase label, countdown — brightest thing on screen. Under it a single-row card strip: OVR, form arrow, readiness tag. Everything else steps back in brightness. Day changed and Start rest sit side by side in the thumb zone.

FORM: Performance Department (sports-science readiness dashboard fused with career-mode progression), the assigned roll, seed 2562ab01.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
