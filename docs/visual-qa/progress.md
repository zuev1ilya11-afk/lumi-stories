# LUMI visual novel execution record

Baseline: `96a48de0fb881be54a3266d46f1b8c4f2d850956` on the existing `feat/prototype-0.1`, PR #1.

## Scope and compatibility

Read all 44 scene texts, relevant components, schema, presentation mapping, assets and existing progress boundary before implementation. `scene-direction.md` covers physical events and staging for every scene. `reachable-paths.json` enumerates all 162 stateful complete routes; every route terminates at the existing `ep1_end_paywall`.

Verified exact equality against baseline for scene IDs, kinds, nextSceneId, choices (including IDs, conditions and effects), transitions and original scene.text. The story engine, progress model/API, analytics architecture, backend, database, auth and project configuration are unchanged. Beat indices and chat timeline are client-only; reopening starts at beat zero of the saved logical scene.

## Implementation and TDD evidence

- Reading/camera/schema tests were first red, then green with beat playback and the data-driven stage.
- Content test was first red for absent per-scene beats/presentation; green with 171 short beats (maximum 161 characters), covering all 44 scenes and 162 paths.
- Timed chat/viewer tests were first red, then green with incoming/outgoing/system ordering, read receipts, finite typing, skip and focus restoration.
- Terminal beat regression was red before adding the local transition from the final scene to its existing offer.
- Independent review found two P2 issues: stale transparent pose after crossfade and missing attachment in later chat history. Both reproduced in new failing tests, fixed and independently re-reviewed. Focused re-review: 16/16 tests, no remaining material finding.
- Mobile visual checks found the 320/360px paywall CTA outside the viewport; fixed and verified. Manual screenshots also caught header/face overlap and paywall portrait cropping; framing now reserves the safe header band and preserves the face.

## Visual QA

Playwright captures 14 views at each of 320×568, 360×740, 390×844, 430×932: arrival, suitcase rescue, identity reveal, first chat, pendant, pendant shock, old photo scene, attachment chat, fullscreen viewer, Junho warning, Lera choice, Mina, frightened Junho and paywall. Tests include 24px Telegram content-top inset and 16px bottom inset; dialogue fits within 35% of viewport, copy does not scroll, no horizontal overflow, and visible choice/CTA targets are at least 44px and inside the viewport.

Contact sheets in this directory preserve the reviewed compositions; full-resolution PNG screenshots are produced by `npm run e2e` and uploaded as GitHub Actions artifacts. Screenshots are explicitly inspected for faces, correct event/pose/environment, dialogue clearance and reachable buttons. They are not merely DOM assertions.

## Verification and release

Local gate: install, 66 frontend tests, TypeScript, story validation (44 scenes), production build, 17 Deno tests and 8 Playwright tests. Three full UI routes (romance/trust, truth/risk, mixed) cover all 44 scenes and all 14 choices. Resume and failed-save/retry are verified. The mock API also counts logical saves to ensure beats never add server writes.

Pages deployment now depends on the complete reusable CI verification job for the exact pushed revision. This continues the existing Pages URL; no new repository/branch/PR/project is created.

A new genuine Telegram smoke remains a separate gate: the available browser shows Telegram's sign-in screen, not an authenticated user session. Mocked Telegram tests and any hosted frontend smoke must never be reported as genuine Telegram smoke. Remote run URLs and hosted results are recorded in PR #1 after release.
