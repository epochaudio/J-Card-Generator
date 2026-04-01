# Print-First Typography Tuning Todo

## Objective

Tune the J-card typography with print readability as the primary constraint, while preserving the current automatic layout behavior as much as possible.

Primary focus:

- redesign the back-panel section header from the current weak `A / B + tiny duration` treatment into a stable `SIDE A / SIDE B` header system
- raise the minimum readable size of dangerous small text on the back, short-back, and spine
- accept controlled layout fallback earlier when that is the safer print choice

This document covers coordinated changes in:

- `src/components/ContentBack.jsx`
- `src/components/ShortBackContent.jsx`
- `src/utils/ShortBackTrackLayout.js`
- `src/utils/SpineLayoutEngine.js`
- `src/components/ContentFront.jsx` for reversible side markers only

## Current State Summary

### Current header behavior

- Side identity is rendered as a small circular badge with a single `A` or `B`.
- Side duration is rendered as fixed `12px` mono text at the far right.
- Both elements sit in the same row, but they are not designed as a unified header block.
- The badge scales weakly with `trackFontSize`, so it inherits the body layout pressure.
- Duration does not participate in any adaptive sizing logic.

### Current body layout behavior

- `STANDARD` and `COMPILATION` share the non-classical auto-layout pipeline.
- `CLASSICAL` uses a separate grouped-work pipeline.
- The body already has automatic degradation logic based on measured visual line count and available height.
- Track numbering in non-classical mode is currently continuous across both sides:
  - `SIDE A`: starts from `01`
  - `SIDE B`: continues from `SIDE A` count instead of resetting

### Current print-risk areas outside the main back panel

- Short-back compact track mode still uses several `10px` to `12px` labels and numbers.
- Spine meta text can currently shrink to `10px` to `11px`.
- Reversible front center markers are present but visually weak.

## Design Goals

- Make `SIDE A / SIDE B` readable without zooming the preview.
- Preserve automatic body layout behavior across all three modes.
- Decouple header typography from body typography.
- Keep magnetic tape semantics: each side should read like an independent section.
- Avoid decorative elements that compete with text clarity.
- Keep the solution print-safe on a `618px` back panel.
- Raise dangerous small-text floors in narrow panels without causing unnecessary visual bloat.
- Prefer earlier fallback over unreadable microtype.

## Core Decisions

### 1. Replace badge semantics with section-header semantics

The new header should no longer rely on a circular `A / B` badge as the primary identity marker.

New structure:

- Left: `SIDE A` or `SIDE B`
- Right: side total duration
- Optional center/underlay: subtle separator treatment if needed

The header must read as one band, not as two unrelated floating elements.

### 2. Header typography must be independent from track typography

Header sizing must not be derived directly from `trackFontSize`.

Reason:

- Body text shrinks under layout pressure.
- Header identity should remain stable even when the body compresses.
- The current coupling is one of the reasons the side labels feel too small.

### 3. Side numbering should reset per side in non-classical modes

For `STANDARD` and `COMPILATION`, numbering should become side-local:

- `SIDE A`: `01, 02, 03...`
- `SIDE B`: `01, 02, 03...`

Reason:

- The design is moving to explicit `SIDE A / SIDE B` sectioning.
- Side-local duration is already computed independently.
- Tape usage is side-based, not album-global.
- Cross-side drag/reorder remains understandable if numbering resets by side.

### 4. Classical mode keeps side headers, but not track-first numbering language

`CLASSICAL` should also use `SIDE A / SIDE B` headers, but body structure should continue to prioritize:

- work title
- grouped movement content
- fallback summaries

Track numbering should not be promoted as the primary navigation language in classical mode.

## Mode-by-Mode Layout Policy

### STANDARD

Expected reading pattern:

- Side header first
- Track list second
- Optional note/detail third

Policy:

- Use `SIDE A / SIDE B` as strong left anchor.
- Use side-local numbering.
- Keep current automatic degradation chain for body content.
- Allow duration visibility in the header even if body metadata is reduced.

### COMPILATION

Expected reading pattern:

- Side header first
- Track title plus artist as the important unit
- Optional note/detail after that

Policy:

- Same header system as `STANDARD`.
- Same side-local numbering rule as `STANDARD`.
- Preserve higher priority for artist visibility versus plain standard mode.
- Duration remains in the header even if per-track body metadata is reduced.

### CLASSICAL

Expected reading pattern:

- Side header first
- Work group title second
- Movement/body detail third

Policy:

- Use `SIDE A / SIDE B` headers just like other modes.
- Do not force side-local numeric prefixes into grouped classical lines unless there is a compelling visual reason.
- Keep grouped-work auto-degradation untouched in spirit:
  - inline works
  - trimmed inline works
  - work summary
  - work-only

## Proposed Header System

### Header content

Primary text:

- `SIDE A`
- `SIDE B`

Secondary text:

- total duration for each side, for example `21:34`

### Header styling direction

- Title: uppercase, stronger weight, moderate tracking
- Duration: visually secondary, but not dim enough to disappear
- Color contrast: duration should likely move from `dimTextColor` to `subTextColor` or an intermediate tone
- Decoration: prefer a restrained line or accent bar instead of a filled circle badge

### Header geometry

The header band should have its own layout constants, for example:

- left padding
- right padding
- title font size
- duration font size
- vertical baseline
- minimum spacing between title and duration

These values should not be reused from track-line calculations.

## Auto-Layout Strategy

### What should remain automatic

- Track/body wrapping
- Track/body degradation steps
- Notes visibility reduction
- Classical group-content fallback selection
- Per-track artist/duration suppression in non-classical modes

### What should stop being body-driven

- Side header size
- Side header identity weight
- Side duration size
- Side header spacing rhythm

### Recommended implementation model

Split layout into two conceptual systems:

1. Header system
2. Body system

Header system responsibilities:

- compute a stable header band
- compute title and duration sizing
- reserve vertical space for each side

Body system responsibilities:

- keep the current content measurement pipeline
- begin body layout only after header band height is reserved

### Print-first fallback policy

When size pressure increases, the system should sacrifice lower-priority detail before shrinking important text into the danger zone.

Preferred sacrifice order:

1. back-panel notes
2. per-track tail duration on the back
3. short-back visible track count
4. spine notes
5. classical secondary detail under long work titles

This means the system may fall back slightly earlier than before, but the surviving text should be more legible in print.

## Numbering Strategy

### Recommended default

- Non-classical:
  - `SIDE A` starts at `01`
  - `SIDE B` starts at `01`
- Classical:
  - no strong numbered-prefix requirement in grouped layout

### Why not continuous numbering

- Continuous numbering conflicts with explicit side headers.
- It feels album-list oriented rather than tape-side oriented.
- It weakens the semantic reset that `SIDE B` should create.

### Implementation implication

Current rendering passes `data.sideA.length` into side B rendering so numbering continues globally. This should change so side B rendering restarts local numbering from zero in non-classical layouts.

## Implementation Plan

### Phase 1: Header refactor

- Remove the circular `A / B` badge as the primary side marker.
- Introduce a reusable side-header renderer.
- Render `SIDE A / SIDE B` on the left and total duration on the right.
- Add header-specific typography constants.
- Add header-specific width measurement and overflow guard.

### Phase 2: Vertical rhythm rebalance

- Revisit `headerHeight`, `marginY`, and `gapBetweenSides`.
- Reserve enough space so the stronger header does not visually crush the first track line.
- Reposition divider logic so it supports the new side-band structure.

### Phase 3: Numbering correction

- Reset numbering per side in `STANDARD` and `COMPILATION`.
- Keep classical numbering logic conservative.
- Verify that drag-and-drop updates still produce coherent numbering on re-render.

### Phase 4: Mode validation

- Validate `STANDARD` with short, medium, and dense tracklists.
- Validate `COMPILATION` with artist-heavy lines.
- Validate `CLASSICAL` with grouped works and multi-line headers.

### Phase 5: Secondary panel tuning

- Raise short-back compact typography floors.
- Rebalance short-back density presets so the smallest preset no longer relies on dangerous microtype.
- Raise spine meta typography floors conservatively.
- Allow the spine to reach its existing `no-notes` fallback earlier rather than preserving unreadable small note text.
- Slightly strengthen reversible-front side markers where they participate in print output.

### Phase 6: Polish

- Tune contrast for duration text.
- Decide whether a thin accent line is needed.
- Check export readability in both light and dark themes.

## Detailed Todo List

- [ ] Extract current side-header rendering into a dedicated helper inside `ContentBack.jsx`.
- [ ] Define new header constants independent from `trackFontSize`.
- [ ] Replace `A / B` badge output with `SIDE A / SIDE B`.
- [ ] Replace fixed `12px` duration sizing with header-owned duration sizing.
- [ ] Rebalance header width logic so title and duration do not collide.
- [ ] Keep total duration visible even when body layout is heavily compressed.
- [ ] Change non-classical numbering to reset at the start of each side.
- [ ] Confirm classical grouped layout still avoids unnecessary numeric clutter.
- [ ] Adjust divider position/style to match the new header system.
- [ ] Raise back-panel note and per-track tail-duration minimum sizes moderately.
- [ ] Let back-panel auto-layout hide note or per-track tail duration earlier instead of shrinking them too far.
- [ ] Raise short-back compact label, duration, count, and numbering floors moderately.
- [ ] Rebalance short-back density presets so the compact side may show one fewer visible track when needed.
- [ ] Raise spine note and tape-id minimum sizes conservatively.
- [ ] Accept earlier use of the spine's existing `no-notes` fallback rather than preserving unreadable note text.
- [ ] Validate that long classical work titles may trigger fallback slightly earlier without breaking the structure-first reading pattern.
- [ ] Slightly strengthen reversible-front side markers without making them compete with cover art.
- [ ] Verify preview readability at normal app zoom without relying on export zoom.
- [ ] Verify PNG/SVG export readability in both light and dark themes.
- [ ] Check dense albums where body auto-layout falls to the last degradation level.
- [ ] Check sparse albums where the new header could feel too heavy relative to content.

## Risks

### Risk 1: Header becomes too dominant

If the header is oversized, sparse tracklists may feel visually top-heavy.

Mitigation:

- keep title stronger than body, but not dramatically larger
- tune side gap and divider spacing after implementation

### Risk 2: Header steals too much vertical space from dense bodies

If header height grows too much, dense back panels will trigger harsher body degradation earlier.

Mitigation:

- reserve a modest but fixed header band
- avoid decorative shapes that inflate height without improving clarity

### Risk 3: Back panel hides notes or per-track tail duration earlier

Raising the minimum readable size on the back may cause the layout engine to suppress note text or tail-duration text sooner than before.

Mitigation:

- treat this as an intentional print-first tradeoff
- preserve side header, track title, and overall section readability first
- verify that the fallback order is consistent and predictable

### Risk 4: Short-back shows one fewer visible track

If short-back typography floors are raised, the densest preset may need to show one fewer visible track on some releases.

Mitigation:

- keep the change modest and density-aware
- prefer losing one visible row over relying on 10px-class microtype
- verify that the `+N MORE` summary still keeps the panel informative

### Risk 5: Spine reaches `no-notes` mode earlier

If spine typography floors are raised, the existing spine fallback sequence may reach `no-notes` sooner.

Mitigation:

- keep spine tuning conservative
- preserve title and artist priority above note preservation
- rely on the existing fallback model rather than introducing a new hidden rule

### Risk 6: Classical mode regresses visually

A non-classical header treatment could feel too blunt in grouped classical layouts.

Mitigation:

- keep header system consistent
- keep grouped body logic intact
- validate with long work titles and compressed fallback states

### Risk 7: Classical long-work fallback triggers slightly earlier

Because more of the page is being reserved for readable headers and readable minimum sizes, long classical work titles may fall back one step earlier in dense cases.

Mitigation:

- keep classical fallback structure intact
- prefer earlier summary fallback over unreadable compressed work text
- validate against long grouped titles before finalizing numbers

## Acceptance Criteria

- `SIDE A / SIDE B` is readable in the normal preview without zooming.
- Side durations are readable and visually associated with the correct side header.
- Non-classical numbering resets per side.
- Classical grouped layouts remain structure-first.
- Existing automatic body degradation still works.
- No visible collisions between header title, duration, and body content in common cases.
- Back panels may hide note or per-track tail duration earlier, but no surviving small text should feel obviously under-scaled for print.
- Short-back may show one fewer visible track in dense cases, but the resulting text should be more readable.
- Spine may reach `no-notes` earlier, but title and artist readability should improve or remain stable.
- Long classical work titles may fall back slightly earlier, but grouped hierarchy should remain coherent.

## Out of Scope

- Front cover typography changes
- New user-facing controls for typography density thresholds
- New user-facing settings for numbering mode or header style in this first pass

## Suggested Next Step

Implement the back header refactor first, then apply the moderate minimum-size floor increases panel by panel, validating the expected fallback tradeoffs after each step.
