# Episode 2 release verification

## Delivered content

- Canonical episode ID: `last-online-s1-e2`; start `ep2_morning`; terminal `ep2_end`.
- 53 scenes, 243 authored beats, five decisions with three responses each (15 options).
- 243 Episode 2 choice sequences for each of 162 real Episode 1 endings: 39,366 complete campaign routes. Every scene and option is reachable and all routes terminate.
- 18 original WebP assets: seven Taeyun poses, six environments, five event CGs. Total 2,000,180 bytes. Asset manifest includes hashes and art direction.
- Existing Scene/Beat renderer, typewriter, SOA messenger, local beat playback, bounded preloading, Telegram safe areas, reduced motion and haptics are reused.
- E1→E2 uses the existing progress row and server-confirmed save, retaining every score and flag. Failed saves retry the same candidate. Beat changes do not save.
- All 41 checkpoints from the earlier partial E2 and 15 older response flags normalize without replaying score effects. Original flags remain present.

## Automated coverage

- Frontend: 172 tests in 22 files pass after integrating the previously published commits.
- Typecheck, both story validators, production build: pass. E1 still contains 44 scenes with unchanged content and choice effects.
- Backend Deno: 17 tests pass. No backend, auth, Telegram verification, RLS or schema changes.
- Full Playwright suite: 17 tests pass in 2.6 minutes on the integrated code.
- Browser routes cover trust/romance, truth/investigation and risk/mystery; all 53 E2 scenes and 15 responses are exercised through the UI. Exact save counts, analytics, inherited state, reloads, retry, rapid taps and no beat saves are asserted.
- Route score totals [junho, taeyun, truth, risk]: trust [7,8,4,5]; investigation [5,0,12,4]; risk [1,-3,9,8].
- E1 browser routes retain all 44 scenes and 14 responses.

## Visual QA

Required viewports: 320×568, 360×740, 390×844, 430×932, with Telegram top/bottom safe insets. 233 rendered states per viewport (229 dialogue beats and four chats), 932 in total. Geometry assertions check overflow, fitted text, loaded images and buttons at least 44px. 29 screenshots per viewport, 116 total, are produced under `docs/visual-qa/screenshots/episode-2/` and uploaded by CI.

Contact sheets and key scenes were visually inspected at all four sizes. Faces remain visible below the header; choice buttons and text fit; CGs retain their story subject. Poses change with stage performance, surprise, defensiveness, questioning, teasing and vulnerability. The elevator uses a hand detail before revealing Junho. Found and fixed the narrow-screen 42px menu hit area and E1 attachment label regression.

## Boundaries of verification

Browser E2E uses simulated Telegram context and mocked API responses. It is not a real Telegram smoke test. Telegram Web showed its QR/phone/passkey sign-in page, so an authenticated live Telegram playthrough was unavailable.

CI/Pages run URLs, deployed bundle/asset hash verification and hosted smoke results are recorded in existing PR #1 and the delivery report after publication. No production progress is modified by the unauthenticated hosted smoke.

## Changed areas

- Content: `src/content/last-online/season-1/episode-2.json`, asset manifest, branch map and compatibility episode registry.
- UI: `src/App.tsx`, `src/features/story/StoryScreen.tsx`, `src/features/shell/SeasonScreen.tsx`, `src/features/messages/SoaChatScreen.tsx`, navigation sizing in global/chat CSS.
- Progress: `src/story/episodes.ts`, `src/progress/model.ts`, `src/progress/useProgress.ts`, `src/progress/legacyEpisode2.ts`.
- Tests: episode graph/assets/presentation, progress model/hook/legacy compatibility, App/StoryScreen/SeasonScreen/BeatPlayback; E1/E2 browser and E2 visual suites, shared story fixture.
- Assets: `public/assets/last-online/ep2/` (18 WebP files).
- CI: `.github/workflows/prototype-ci.yml` validates both episodes.
- Documentation: this report, narrative notes, implementation plan and art direction.

Previously published SVG placeholders and the old paywall component remain in repository history and files; the active Episode 2 story renders the new WebP artwork and its actual continuation screen.
