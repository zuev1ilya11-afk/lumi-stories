# Episode 1 Visual Novel Implementation Plan

> Execute with superpowers:executing-plans, TDD and a final independent review. The user explicitly requests autonomous implementation through verified deployment.

**Goal:** Turn all Episode 1 branches into a paced mobile visual novel.
**Architecture:** Optional presentation/beat data around the existing scene graph; local playback state; unchanged server boundaries.
**Tech Stack:** React, TypeScript, CSS, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-03-episode-1-visual-novel.md`

## Global Constraints

- Existing branch and PR only; no backend, auth, score, flag, choice ID or scene ID changes.
- No real payments or Episode 2; preserve save-before-advance and existing analytics.
- Generate original consistent artwork, optimize to WebP and load only current/adjacent frames.
- Respect reduced motion and safe areas at 320, 360, 390 and 430 px.

## Review Focus

- Rapid taps cannot skip unread text or send duplicate logical actions.
- Failed saves keep the final beat and allow retry; remount resumes first beat of saved scene.
- Reduced-motion users get immediate text and readable chat without compulsory animation waits.
- Long translated text/three choices remain reachable on smallest viewport and with large safe insets.
- Adjacent chat scenes deduplicate history without dropping new messages; attachments restore focus.

### Task 1: Reading and presentation contracts

Files: `src/story/schema.ts`, `src/features/story/{StoryScreen,DialogueBox,ChoiceList,presentation,CinematicStage,useBeatPlayback,useReducedMotion}.tsx/ts`, tests alongside.
Interfaces: `Beat`, `ScenePresentation`, `CharacterPresentation`; `getSceneBeats(scene)`; beat playback `{index, visibleText, complete, final, tap}`; existing async choose/advance callbacks.

- [x] Add failing component tests for first tap completion, second tap next beat, final-only choices/save, async lock and data-driven camera/character overrides.
- [x] Run tests and record RED.
- [x] Add schema validation, playback hook, layered renderer, preload and motion CSS.
- [x] Run component suite/typecheck and record GREEN.

### Task 2: Content and original art

Files: Episode JSON/asset manifest, `public/assets/last-online/v2/`, scene direction and art manifest in `docs/visual-qa/`.
Consumes Task 1 metadata. Produces authored beats and complete scene asset paths.

- [x] Add failing content test for every scene having paced presentation and all 162 routes terminating.
- [x] Author beats retaining narrative text; attribute actual speech only. Map all 44 scenes and branch reactions.
- [x] Generate style reference, character states, event CGs and missing environments; optimize assets.
- [x] Verify assets exist and graph/effects match baseline exactly.

### Task 3: Messenger and image viewer

Files: `src/features/messages/{SoaChatScreen,AttachmentViewer}.tsx`, tests.
Interfaces: existing props preserved; shared-prefix history passed by keyed scene wrapper; timeline read/typing states remain client-only.

- [x] Add failing tests for timed message roles, read state, typing end, delayed choices, skipping, image close/focus and duplicate clicks.
- [x] Implement timed sequential messages and fullscreen attachment viewer.
- [x] Run unit suite and existing progress tests.

### Task 4: Visual/E2E verification and release

Files: `e2e/`, `docs/visual-qa/`, frontend Pages workflow if its deploy gate requires correction.

- [x] Update E2E to advance beats, traverse three named routes and cover every scene/choice; verify retry and resume.
- [x] Capture seven milestones at 320/360/390/430; inspect screenshots and fix layout defects.
- [x] Run npm install, unit, typecheck, story validation, build, Deno, E2E gates.
- [x] Independent review; fix material findings with RED→GREEN.
- [ ] Push existing branch, inspect CI/Pages jobs, run hosted smoke and genuine Telegram smoke if an authenticated session is available. Report any unverified gate honestly.
