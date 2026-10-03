# Дом чёрных роз — release QA

Date: 2026-10-03. Implementation base: `b989675411fcb9db9906698e1c3fa3e77b05cf3d`. Publication base: `bcc0c8a877330d0dd798b26abf5bf437bc499f32`; its parallel moon/star animation is preserved.
Existing branch `feat/prototype-0.1`, existing PR #1. Deployment/CI evidence belongs to the exact PR head checks; this report records local review rather than claiming a real Telegram session.

## Content and art

- 29 engine scenes, 202 short beats, 3 decisions / 7 options / 12 complete paths.
- All routes reach `gothic_ep1_end`; no cycle or unreachable scene. Route states and 2,635–2,700 word counts are in `verified-paths.json` (approximately 10–15 minutes at 180–260 words/minute, individual reading speed varies).
- All provisional scene IDs and choice IDs/effects remain compatible with saved progress.
- 30 original WebP images, 2,885,322 bytes total. Every accepted original was opened and inspected before integration. Identity, anatomy, grip, clothing, perspective and visual continuity are recorded in `art-direction.md` and `art-manifest.json`.
- Portrait reveal is dress/hands → face → reaction → plaque → full double portrait. Neither Adrian's painted face nor the double portrait occurs before the reveal. Dates and final line match the brief.
- First Evelyn appears only in the painting. No Lucian/Isabelle introduction, vampire claim, jump scare or flashing effect.
- Eight Evelyn states (including coatless night variant), seven Adrian states, six environments and nine event/detail CGs; exterior doubles as the opening CG and cover.

## Automated checks

- Frontend: 197 tests across 30 files; typecheck and production build pass.
- Story validator: all four existing Last Online episodes and new Roses episode pass.
- Backend regression: 30 Deno tests pass; no backend files changed.
- Browser coverage includes all 12 Roses routes with exact visited scenes, final scores/flags, correct scene-boundary save counts and unchanged Last Online data.
- Browser route 000 verifies a failed save/retry, reload at a safe boundary, Last Online → Roses → Last Online and returning to the finished Roses season.
- Unit regression covers a delayed reload, wrong story/season identity and switching away/back while a choice save is in flight. The returned view waits for that write, then reads the committed server state; the saved decision cannot be silently replaced.
- Full regression suite: 45 Playwright tests pass, including the existing Last Online routes, visual checks, payment/free access and retries. CI repeats the full suite on the exact published commit.

## Mobile and visual inspection

Tested 320×568, 360×740, 390×844, 430×932 with simulated Telegram content-safe top 24px and bottom 16px.

At every size: every artwork, all three choice screens, the longest text beat, library and season were rendered and inspected. Image decoding, no horizontal overflow, dialogue text fitting, control dimensions ≥44px and safe-area bounds are checked automatically. The library's second card remains above navigation after scrolling. Episode 1 is free; the four named future episodes remain in development.

Representative in-app evidence: `mobile-320.jpg`, `mobile-360.jpg`, `mobile-390.jpg`, `mobile-430.jpg`, `library-and-season.jpg`. Full screenshots are generated under `docs/visual-qa/screenshots/black-roses` and retained by the CI artifact step.

Resolved before release:

1. A 320px dialogue was constrained by the shared 34dvh limit. Roses now permits 40dvh and preserves the footer's 44px height; its longest beat fits.
2. Library navigation had 35px hitboxes and could overlap a scrolled card. The library has 44px navigation targets and its own bounded scroll area above navigation.
3. The final independent review reproduced the in-flight save round-trip race. A failing regression was added, then save-before-load coordination fixed it. No other blocking review finding was reported.

## Scope and limits

- Last Online story JSON and artwork remain byte-for-byte unchanged. No database migration, backend, authentication, Stars or payment-formula change.
- Story identity is `house-of-black-roses` / `season-1`; existing generic server storage supports this identity. Scores and flags use a separate row. All first-season access is free through the existing Roses runtime; no fake purchase is recorded.
- Browser tests use the existing Telegram fixture and mocked API storage. They do not claim an authenticated production playthrough or physical iOS/Android Telegram verification. Public deployment smoke and served-file hashes are verified separately after Pages succeeds.
