# Episode 2 branch map — «Тот, кого все знают»

Entry: `ep2_morning`. Only terminal: `ep2_end`. Episode 1 state is passed through unchanged; Episode 2 choices increment the existing four scores and write five new `ep2_` flags. There are no resets, migrations, choice locks, random edges, or schema changes.

## Coverage

- 53 scenes, each with 2–7 individually directed beats; 243 beats total.
- Five choice nodes, each with three unconditional options: 15 options and exactly 3⁵ = 243 distinct decision sequences per fixed starting state.
- Episode 1 yields 162 distinct terminal states. Every one supports all 243 Episode 2 decision sequences: 39,366 complete campaign routes.
- The campaign traversal reaches every scene and option, resolves all references, terminates at `ep2_end`, preserves every inherited flag and adds score deltas to inherited values.
- A neutral standalone state also supports 243 routes. Scene count differs between routes because incoming flags select different dialogue.

## Decision effects

| Choice node | Option | Score increments | New flag | Immediate branch |
|---|---|---|---|---|
| `ep2_recognized` | `ep2_phone_truth` — Сказать правду о новой SIM-карте | `taeyunScore` +2, `truthScore` +1 | `ep2_phone_response = truth` | `ep2_phone_truth` |
| `ep2_recognized` | `ep2_phone_demand` — Потребовать объяснить, чей это номер | `truthScore` +2, `riskScore` +1 | `ep2_phone_response = demand` | `ep2_phone_demand` |
| `ep2_recognized` | `ep2_phone_lie` — Сказать, что это временный рабочий телефон | `taeyunScore` -1, `riskScore` +2 | `ep2_phone_response = lie` | `ep2_phone_lie` |
| `ep2_photo_choice` | `ep2_photo_full` — Показать фотографию целиком | `taeyunScore` +1, `truthScore` +2, `riskScore` +1 | `ep2_photo_evidence = full` | `ep2_photo_full` |
| `ep2_photo_choice` | `ep2_photo_pendant` — Показать только подвеску на снимке | `truthScore` +1, `junhoScore` +1 | `ep2_photo_evidence = pendant` | `ep2_photo_pendant` |
| `ep2_photo_choice` | `ep2_photo_refuse` — Убрать телефон: «Пока нет» | `taeyunScore` -1, `junhoScore` +1, `riskScore` +1 | `ep2_photo_evidence = refuse` | `ep2_photo_refuse` |
| `ep2_archive_choice` | `ep2_archive_taeyun` — Пойти в архив с Тэюном | `taeyunScore` +2, `riskScore` +1 | `ep2_archive_partner = taeyun` | `ep2_archive_taeyun` |
| `ep2_archive_choice` | `ep2_archive_mina` — Позвать Мину и пойти с ней | `truthScore` +2, `riskScore` -1 | `ep2_archive_partner = mina` | `ep2_archive_mina` |
| `ep2_archive_choice` | `ep2_archive_soa` — Сначала спросить SOA об архиве | `truthScore` +1, `riskScore` +2 | `ep2_archive_partner = soa` | `ep2_archive_soa` |
| `ep2_rooftop_choice` | `ep2_rooftop_believe` — Поверить ему — пока | `taeyunScore` +2, `riskScore` +1 | `ep2_rooftop_response = believe` | `ep2_rooftop_believe` |
| `ep2_rooftop_choice` | `ep2_rooftop_suspect` — Сказать, что его молчание подозрительно | `truthScore` +2, `taeyunScore` -1 | `ep2_rooftop_response = suspect` | `ep2_rooftop_suspect` |
| `ep2_rooftop_choice` | `ep2_rooftop_junho` — Позвонить Джунхо при нём | `junhoScore` +2, `truthScore` +1 | `ep2_rooftop_response = junho` | `ep2_rooftop_junho` |
| `ep2_card_choice` | `ep2_card_take` — Взять карту B17 | `taeyunScore` +1, `truthScore` +1, `riskScore` +2 | `ep2_card_response = take` | `ep2_card_take` |
| `ep2_card_choice` | `ep2_card_refuse` — Не брать, но записать код и номер | `truthScore` +2, `riskScore` -1 | `ep2_card_response = refuse` | `ep2_card_refuse` |
| `ep2_card_choice` | `ep2_card_send` — Отправить Джунхо фотографию карты | `junhoScore` +2, `riskScore` +1 | `ep2_card_response = send` | `ep2_card_send` |

All options enter different scenes with different dialogue before rejoining. The archive companion affects who requests access, what Lera tells Mina, or the SOA exchange. The rooftop response changes what Lera offers Taeyun before Junho's relationship-dependent intervention. Card ownership also changes the subsequent lift scene.

## Inherited state gates

Conditions use the existing first-matching-transition semantics. Each gate has an unconditional `nextSceneId` fallback, including for a neutral standalone state.

| Gate | Incoming condition, in priority order | Destination and visible consequence |
|---|---|---|
| `ep2_morning` | `photo_called_junho = true` | `ep2_morning_called`: zero-second nighttime call and the interrupted question |
| `ep2_morning` | `photo_replied_soa = true` | `ep2_morning_replied`: Lera rereads “Да” / “И он знает почему” |
| `ep2_morning` | `photo_saved = true`, or fallback | `ep2_morning_saved`: examines the retained photo, score and pendant |
| `ep2_hall` | `trusted_junho_warning = true` | `ep2_hall_trust`: coffee, softer concern and a request to check in |
| `ep2_hall` | `evaded_junho = true`, or fallback | `ep2_hall_evaded`: distrust, guarded directions and an unanswered question |
| `ep2_soa_history` | `told_junho_soa = true` | `ep2_soa_told`: finishes the disclosure she intended but did not complete in E1 |
| `ep2_soa_history` | `hid_soa_message = true` | `ep2_soa_hidden`: keeps the messages hidden while answering truthfully about Mina |
| `ep2_soa_history` | `replied_soa = true` | `ep2_soa_replied`: admits she answered; Junho asks her to call a living person before replying again |
| `ep2_soa_history` | fallback | `ep2_soa_hidden` |
| `ep2_archive_reflection` | `deep_scandal_search = true` | `ep2_archive_deep`: recalls the deleted comment and separates a shared uniform from an identified face |
| `ep2_archive_reflection` | fallback | `ep2_archive_caution`: distinguishes the footage from proof of guilt or innocence |
| Each rooftop response branch | `junhoScore >= 4` | `ep2_junho_close`: thanks her for disclosure, acknowledges his delay, comes to answer |
| Each rooftop response branch | fallback | `ep2_junho_distant`: starts with a prohibition, is challenged, then gives a concrete meeting point |
| `ep2_lift_checkpoint` | `ep2_card_response = take` | `ep2_lift_yours`: Lera lends the card to Taeyun for the internal reader and explicitly requests its return |
| `ep2_lift_checkpoint` | fallback: refuse/send | `ep2_lift_his`: Taeyun takes his retained/returned card from the pocket and scans it |

Every original E1 flag is preserved, including flags not used as gates here. The relationship threshold uses the current score, so the new choice to call Junho can move a borderline inherited relationship into the closer response.

## Shared progression

| Segment | Progression |
|---|---|
| Morning | `ep2_morning` → photo aftermath → `ep2_hall` → trust/evasion → `ep2_soa_history` → disclosure/concealment/reply → `ep2_mina` |
| Public meeting | `ep2_event` → `ep2_call` → `ep2_recognized` → phone response → `ep2_last_call` |
| Private evidence | `ep2_photo_choice` → photo response → `ep2_soa_incoming` → `ep2_soa_outgoing` → `ep2_archive_choice` |
| Archive | archive partner → `ep2_archive_permission` → `ep2_archive_0226` → `ep2_archive_reflection` → research aftermath |
| Rooftop | `ep2_rooftop` → `ep2_rooftop_choice` → response → close/distant Junho intervention → `ep2_soa_door` |
| Card and lift | `ep2_card_intro` → `ep2_card_choice` → card response → `ep2_lift_checkpoint` → ownership-specific scan → `ep2_blocked` → `ep2_confrontation` → `ep2_end` |

## Continuity and access

- The morning follows Episode 1. A zero-second photo-call never becomes a completed conversation. The `told_junho_soa` route acknowledges that E1 only showed Lera intending to tell him.
- The pendant itself remains with Junho, who took it in E1. The “pendant” choice shows a crop of the photo; it does not conjure the pendant into Lera's hand.
- Taeyun is 25, Korean, and a current ECLIPSE idol at fictional VANTA. He remembers Soa's number because he repeatedly called it after her disappearance. His final call to her that night was **02:17**: she answered silently, music sounded behind her, and the line disconnected.
- The student livestream takes place at VANTA. Taeyun finishes the short live segment before the private rehearsal-room conversation.
- Coordinator Han is introduced at the event and has an established archive role. Taeyun asks for the fragment, Han verifies the keeper's permission and operates the archive herself. Mina's volunteer badge alone does not authorize restricted footage. SOA's clue is not an access credential.
- The authorized fragment shows Soa and an unidentified man in an ECLIPSE jacket at **02:26**, approaching B17. Taeyun appears running toward them in the reflection. Neither a jacket nor a reflected movement establishes motive, identity or guilt.
- B17 was an ECLIPSE rehearsal/service room. **0217** is the old access code on the card and may or may not explain the **02:17** call. Nine minutes remain unaccounted for.
- Han verifies that the card is active and authorizes descent to the staffed B17 post. The actual room door is to remain closed until Han and the duty attendant arrive. Mina stays upstairs and knows the destination.
- On **take**, Lera owns the card temporarily and passes it to Taeyun only for the lift reader. On **refuse**, she records both sides without taking custody; Taeyun retains it. On **send**, she borrows the card for a photograph, sends the photograph to Junho, then returns the physical card to Taeyun for the reader. Junho explicitly asks that Taeyun return it to her afterward.
- Junho receives Lera's location and actively travels to VANTA in both relationship branches, giving him a reason to arrive at the lift. Black sleeve, blocking hand, then the familiar scar **at his eyebrow**, matching E1.
- The final spoken exchange is Junho: “Отдай ей это.” / Taeyun: “Ты опоздал на три года.” No room is opened and no hidden identity is resolved.

## Presentation and messenger

Episode 2 references six new environments, all seven Taeyun states and four new cinematic illustrations under `assets/last-online/ep2/`; E1 backgrounds and Lera/Junho/Mina states are reused at their existing `v2` paths. CG scenes explicitly set `characters: []`. Scene and beat camera, motion, position, emotion and pose metadata use the existing renderer contract.

SOA content uses existing `kind: message` / `chat.messages` UI with incoming and outgoing roles, read receipts, sequential reveal and system status. The required messages are “Он хорошо помнит время. Спроси, почему он был рядом.” and later “Не открывай дверь, если Тэюн рядом.” They coexist with care for Lera without revealing the sender's full knowledge or identity.

Human-readable full script: `docs/episode-2-narrative.md`.

## Verification

`src/story/episode-2.test.ts` first failed on an existence assertion while Episode 2 was absent (RED), then passed with the content. It verifies schema/references, all E1 → E2 paths, 243 choice sequences for every deduplicated E1 terminal state, score carryover, flag preservation, every scene/option, meaningful inherited-state gates, messenger ordering, short beats, Taeyun states, CG overrides, established asset references and card custody. New asset binary delivery is independently verified by the Episode 2 asset manifest suite when generation completes.
