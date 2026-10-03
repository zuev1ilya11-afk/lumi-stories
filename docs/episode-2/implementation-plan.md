# Episode 2 implementation plan

Goal: ship «Тот, кого все знают» on the existing Episode 1 scene/beat engine, current feat/prototype-0.1 and PR #1.
Spec: user’s complete Episode 2 brief dated 2026-10-03. Autonomous implementation, commit, push and deployment explicitly authorized. No new branch/PR/backend/schema/auth changes.

## Tasks and ownership
- Narrative: episode-2.json and branch-map; 5 meaningful three-option choices; inherited E1 flags and Junho affinity drive actual scenes. Existing parseEpisode + graph tests must prove all routes terminate and every option is reachable.
- Integration: episode registry, episode-aware progress machine/hook, App and season/terminal UI. Retain every E1 score/flag at server-confirmed transition. Test save failure/retry, concurrency, reload and no beat saves.
- Art: seven distinct original Taeyun states, six environments, four event CG. Same E1 style anchor; transparent full-body sprites; optimized WebP and manifest. Camera and beats authored in content, existing renderer.
- QA: three end-to-end E2 routes; all E1 tests; 320x568, 360x740, 390x844, 430x932 with Telegram insets; screenshots, readable text, buttons >=44px, no overflow, valid images.
- Release: npm install/tests/typecheck/validate E1+E2/build/Deno/E2E; fresh code review; commit/push current branch; check Actions, Pages and actual deployed files. Report live Telegram smoke separately from browser mocks.

## Review focus
- Failed transition or retry cannot reset or double-apply inherited state.
- All three card choices yield coherent visible custody at final elevator scene.
- Saved E2 progress selects correct content after reload; menu does not restart.
- 320px content fits while CG faces remain beneath safe header.
- No Episode 1 data/effects/auth/RLS migrations changed.

## Execution record
- Base a7271f21db15b2e41eaddb8f17e92e4aa3c91dc1 verified from GitHub and clone. No partial E2 exists.
- npm install completed (124 packages).
- Backend already accepts episodeId and upserts by player/story/season: no backend work needed.
- Parallel independent narrative/integration tasks use disjoint files; root owns art/QA/release.
