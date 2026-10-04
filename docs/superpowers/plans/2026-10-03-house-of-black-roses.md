# House of Black Roses — Episode 1 implementation plan

> Execution: superpowers:executing-plans, continuously in the existing branch as explicitly requested. Existing user brief is the approved design. No new branch, repository or PR.

**Goal:** Publish a complete 10–15 minute gothic romance episode with original canonical art, three branching decisions, and independent saved progress.
**Architecture:** Extend the existing story registry and provisional episode at b989675. Keep the existing scene-boundary save machine, generic progress API, current story IDs, scene IDs and choice IDs. No database/backend/auth/payment changes are needed: progress already keys on player/story/season.
**Tech stack:** Existing React/TypeScript/Vite/Vitest/Playwright; Imagegen artwork optimized to WebP.
**Spec:** User brief “Дом чёрных роз / Наследница” dated 2026-10-03 and the attached approved character bible.

## Global constraints
- Current feat/prototype-0.1 and PR #1 only; retain concurrent changes.
- Do not modify Last Online content or assets, Business OS, Supabase, authentication, Stars formulas.
- house-of-black-roses / season-1; first season free; episodes 2–5 listed as in development.
- Short beats; exactly three decisions, 3×2×2 paths, shared portrait cliffhanger.
- Evelyn/first Evelyn share a face; Adrian is identical in the old portrait and present day. Lucian/Isabelle absent.
- Open and visually inspect every generated image before connecting it. Fix anatomy rather than hiding it.

## Review focus
- Switching stories while a save or reload is pending must not import the old story state.
- A mismatched server progress response must fail safely rather than be committed to another story.
- Saved provisional scene/choice IDs must continue working, without repeating effects.
- Portrait framing must hide Adrian until his reveal, even at the smallest mobile size.
- No global gothic CSS should change Last Online; full art and text must remain usable with safe areas.

## Tasks
1. Progress isolation: add tests for switches, failed saves/retries, late responses and identity mismatch; run baseline then failing new checks; minimally correct evidenced issues. Retain existing API DTO score fields for compatibility; Adrian trust is the story-scoped relationship score, documented in narrative metadata.
2. Art: save canonical reference, produce 7 Evelyn and 7 Adrian states, 6 locations and 9 key event shots; inspect each; record prompts/QA and optimize accepted files under public/assets/house-of-black-roses/v1. No unreviewed image goes into episode.
3. Narrative: expand existing episode JSON, preserve provisional IDs/choices, add short sequential scenes where needed. Add graph/reading-length/assets/reveal-order tests first. All 12 paths must terminate at gothic_ep1_end. Keep choice effects compatible with provisional saves.
4. UI integration: connect cover and story-scoped gothic style, use existing camera/beat renderer; exact plaque text and gradual portrait reveal. No rewrite of shared renderer unless a concrete test requires it.
5. QA: unit suite, typecheck, story validation, build and existing E2E; new UI branch coverage, per-story storage/reload/retry checks; inspect all art in context at 320×568, 360×740, 390×844, 430×932; safe areas, overflow, ≥44px controls.
6. Review and publish: fresh code review, fix significant issues with tests; check remote HEAD, preserve parallel commits; push existing branch, monitor CI/Pages, verify served build and asset hashes. Record real Telegram smoke separately from mocked E2E.

## Ledger
- Base confirmed: b989675411fcb9db9906698e1c3fa3e77b05cf3d.
- Existing story is a brief text-only provisional episode. It must be expanded, not duplicated.
- Backend read: progress GET/PUT already scoped by storyId/seasonId. No backend changes required.
- User explicitly authorizes continuous implementation and publication; no new approval gate.
- Implementation: 29 scenes, 202 beats, 12 routes, 30 individually reviewed images; provisional IDs/effects preserved.
- Local fixes: stale reload/identity guards, in-flight save round-trip coordination, Roses 320px dialogue height, library 44px targets/scroll bounds.
- Final independent review found the round-trip save race; reproduced RED, fixed and verified GREEN. No other blocking finding.
- QA evidence and execution scope: `docs/house-of-black-roses/qa.md`. CI/Pages verification is attached to the existing PR head after publication.
- Final full local suite: 197 frontend, 45 E2E, 30 backend tests passed. Remote HEAD advanced to bcc0c8a during QA; preserved its moon/star animation and continued on that HEAD.
