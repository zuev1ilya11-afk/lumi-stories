# Наследница — season 1, episode 1

Story identity: `house-of-black-roses`; season: `season-1`; episode: `house-of-black-roses-s1-e1`.

The approved eight dramatic scenes are divided into 29 engine scenes with 202 short beats. All provisional scene IDs and all seven choice IDs/effects from b989675 are retained. Added scenes insert detail without repeating decisions. Saves occur on existing engine scene boundaries, never per beat.

The episode covers arrival, 30-day inheritance condition, Adrian, three rules, black roses, midnight visitor, petals, gallery and portrait. No explanation of the mystery or future character introduction is added. All 12 routes converge on `gothic_ep1_end` and the exact final line: «Я надеялся, что у нас будет больше времени.»

## Choices retained for future episodes

| Decision | Consequences |
| --- | --- |
| Ask why | Truth +1, Adrian trust +1; gothic_rules_response=question |
| Defy | Risk +2; gothic_rules_response=defy |
| Agree | Adrian trust +1; gothic_rules_response=accept; extra warning about hearing her name |
| Open door | Risk +2, truth +1; gothic_opened_midnight_door=true |
| Keep closed | Truth +1; gothic_opened_midnight_door=false; exits only after glass breaks and fear someone is injured |
| Enter alone | Truth +2, risk +1; gothic_gallery_choice=alone |
| Call Adrian | Adrian trust +1, risk −1; gothic_gallery_choice=adrian; he responds suspiciously quickly |

The existing API DTO retains its legacy score column names. Within this story's separate row, `junhoScore` is the first relationship slot (Adrian trust), `taeyunScore` is unused, and truth/risk retain their meanings. This preserves provisional saved effects and avoids a backend/schema change. It does not access or change Last Online's scores.

First season is free through the existing story runtime. Episodes 2–5 retain the requested names and remain in development. No purchases or fake ownership records are written.
