# Episode 1 visual presentation

The user's 25-section brief is the approved scope. Continue `feat/prototype-0.1`, PR #1, starting at `96a48de0fb881be54a3266d46f1b8c4f2d850956`.

## Design

Logical scenes, choices, effects, flags, scores, API and server progress remain unchanged. Add optional typed `beats` and `presentation` to existing scene content. Each beat has short text, optional speaker and visual overrides. A keyed scene player owns local beat/typewriter state. First tap completes text; subsequent tap advances a beat; only the final beat can call the existing progress callback. An immediate ref lock prevents duplicate async actions. Failed saves keep the current final beat.

A data-driven stage renders background/CG, ambience, positioned character cutouts, shade, cinematic effects, dialogue, choices and top UI. No episode IDs in presentation lookup. Asset paths are content-owned. Support reduced motion, keyboard access, Telegram safe areas and 320–430 px viewports. Keep essential image action above dialogue. Preload current assets and first frames of immediately reachable scenes only.

SOA scenes use a timed messenger timeline, preserve shared history across adjacent scenes, reveal incoming/outgoing/system events sequentially, delay read receipts and typing, and allow instant reveal. Choices wait for timeline completion. Attachments open a focus-managed fullscreen viewer with close button, Escape and swipe-down. Real sending, auth and paywall behavior do not change.

Original Korean webtoon identities are anchored in one four-character reference sheet. Every state has its own full-body transparent art. Eight key CGs show physical events; environments cover hallway, room, campus, cafe and classroom. Documentation maps all 44 scenes to physical action, location, people, mood, framing, motion and beats.

## Verification

The graph has 44 reachable scenes, five choice nodes, 162 complete routes and one terminal (`ep1_end_paywall`). Preserve these and exact logical fields. TDD covers reading, async guards, chat, attachments and metadata. Playwright traverses romance/trust, truth/risk and mixed routes, checks every scene via coverage paths, captures seven milestones at four mobile widths, and verifies persistence/retry. Run user gates before push; require remote CI/deployment evidence and hosted smoke. A genuine Telegram smoke must be reported separately from mocked Telegram tests.
