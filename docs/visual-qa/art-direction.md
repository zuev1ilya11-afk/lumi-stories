# Episode 1 art direction and asset provenance

All imagery is original generated artwork, created for LUMI with the image generation tool. No real performers, groups or franchise characters are referenced. Eight event illustrations, twenty-five transparent full-body states and five environments derive from one character/style reference (`public/assets/last-online/v2/cg/character-reference.webp`). The optimized WebP bundle is approximately 3.4 MiB; the reference itself is not requested by the renderer.

The machine-readable asset manifest records every delivery path, size and SHA-256 in `src/content/last-online/season-1/episode-1.assets.json`.

## Shared identity anchor

Premium Korean webtoon with a slight anime influence, grounded adult anatomy, delicate ink, painterly shadows, restrained neon and cinematic romance/mystery lighting. Maintain face, hair, accessories and wardrobe across every generation. Full-body transparent states keep heads, hands and shoes inside the canvas.

- **Lera, 22:** long wavy chestnut hair, hazel eyes, dusty rose cable cardigan, ivory camisole, charcoal skirt, black ankle boots, small round silver necklace, black crossbody bag.
- **Junho, 25:** Korean, tousled black hair, dark eyes, black jacket/turtleneck/trousers/boots, silver hoop and a subtle scar. Guarded body language changes into visible fear around the pendant.
- **Mina, 22:** Korean, short bob, sage overshirt, white tee, jeans, white sneakers, mustard tote.
- **Soa, 22:** Korean, shoulder-length black hair and bangs, pale blue blouse, cream skirt, black flats, silver star pendant. Appears only in the archival photograph.

## State and pose direction

| Character | States |
|---|---|
| Lera | neutral, arrival with luggage, tired, curious, shy, suspicious, concerned, shocked, defensive, frightened, phone-reading |
| Junho | neutral, guarded, distant, suspicious, warning, intense, surprised, frightened, soft, vulnerable |
| Mina | friendly, excited, gossip, surprised |

The manifest is the reusable catalog; each beat selects only the state that fits its action. Not every catalog state must be forced into this episode. Left/right/center, depth and full-body/medium/close-up placement are renderer metadata.

## Event CG direction

1. **arrival:** Lera seated beside a rain-covered bus window, rolling suitcase and reflected Hansu neon.
2. **first-meet:** Junho catches the leaning suitcase at the lift; Lera reaches toward it. Both figures and the action are visible.
3. **reveal:** Mina holds a phone with Junho's archival stage portrait while Lera recognizes him at the campus café. ECLIPSE is fictional.
4. **soa-ping:** Lera alone at home at night, a phone glow interrupts her quiet evening.
5. **pendant:** Lera's hand picks up the star, broken packaging and music sheets on the hallway floor.
6. **pendant-shock:** Lera raises the star; Junho recoils with frightened eyes and tense hands, watching the stairwell.
7. **old-photo:** Soa and Junho in the same apartment, viewed from the bedroom doorway. Star necklace, held wrist, window tower/bridge and piano provide the story clues.
8. **cliffhanger:** Lera clutches her phone and listens at the closed door; reflection and cold hallway light sustain the mystery.

Environments: warm apartment hallway, Lera's night apartment with the identifying window/piano, morning university, campus café, classroom. Reused environments indicate the same location; unrelated dramatic events use their own CG or poses.

## Delivery and motion

900px-wide event/environment WebP and 600px-wide alpha-preserving character WebP; only current, next beat and immediately adjacent scene shots are preloaded. No game engine, video textures or whole-episode image preload.

Scene camera uses restrained zoom, drift, pull-out and reveal; actor entry and emotion crossfade; dialogue rise/typewriter; staggered choices; brief dark pulse/flash/shake and optional Telegram haptic. Reduced motion disables cinematic animation and compulsory text/chat delays. No sound files are loaded; sound markers are reserved metadata.
