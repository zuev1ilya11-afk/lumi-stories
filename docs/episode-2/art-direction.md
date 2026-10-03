# Episode 2 art direction

18 original raster illustrations generated with the built-in image_gen tool, never real performers or existing band imagery. ECLIPSE and VANTA are fictional. Shared style/identity reference is Episode 1's `public/assets/last-online/v2/cg/character-reference.webp`.

## Taeyun

Seven separate transparent full-body sprites: neutral, stage, amused, guarded, serious, surprised, vulnerable. Identity: Korean adult 25, honey-ash-brown parted hair, amber eyes, ivory tailored blazer, wine satin shirt, charcoal trousers, black loafers, silver bracelet/ear stud. Stage charm and private fear are separate expressions and poses. His silhouette, wardrobe and expression contrast with Junho's black wardrobe and reserved manner.

## Environments

- University student livestream at VANTA: intimate stage, ECLIPSE backdrop, lavender lighting and volunteer equipment.
- Backstage: warm makeup lights, wardrobe rack and cool service corridor.
- Practice room: worn parquet, piano, mirror wall and taped rehearsal marks.
- Archive: monitors, retained tapes, records and cyan/amber work light.
- Rooftop: Hansu tower/bridge at sunset, railings and service door.
- Service lift: industrial steel, fluorescent lighting and card reader.

## Event CG

1. Number recognition: Taeyun freezes looking at his phone while Lera makes the call. Rear-case phone graphics were corrected after visual review.
2. Camera 02:26: Soa at B-17, faceless person in ECLIPSE jacket, running Taeyun visible in reflection only. This establishes proximity without resolving guilt.
3. B-17 / NIGHT ACCESS card offered to Lera, scratched edges and rooftop light.
4. Elevator hand: black sleeve and a healthy hand stop the doors, with no face revealed.
5. Elevator confrontation: Lera between Junho and Taeyun, Taeyun visibly retains the card, Junho holds the door. Junho's eyebrow scar follows Episode 1 canon.

Scene `ep2_blocked` begins on the hand detail. Beat 2 reveals the complete confrontation; this avoids showing the entrant's identity before the text reveals him. Haptics/effects occur only on four narrative impacts; reduced motion continues to suppress animation/haptics/delays.

## Delivery

`public/assets/last-online/ep2/`: character WebP 600×900 with alpha; background/CG WebP 900×1350. Total 1,870,504 bytes (~1.78 MiB). Current/adjacent shots use existing bounded preload. No video engine or whole-episode image preload was added.

Exact delivery paths, dimensions, sizes, alpha, SHA-256 and prompt records: `src/content/last-online/season-1/episode-2.assets.json`.

## Phone and hand correction

User review refined both phone bodies/grips in `recognized-number-v2.webp`: screens face their users, opaque rear cases show only camera hardware. `night-access-v2.webp` corrects the receiving hand's thumb length, joint and palm transition. Both images were edited with built-in image_gen. Versioned filenames prevent stale cached art; story decisions and scene IDs are unchanged.
