# LUMI — «Последний онлайн» — Эпизод 1: карта ветвлений

## Назначение

Эпизод знакомит игрока с Хансу, Лерой и Джунхо, раскрывает старый скандал ECLIPSE/VANTA, запускает переписку с аккаунтом SOA и заканчивается одной и той же фотографией Соа и Джунхо, снятой из квартиры Леры несколько лет назад.

Все ветки сходятся к `ep1_end_paywall`. Выборы меняют состояние истории, реплики и локальные сцены, но не отменяют главный клиффхэнгер.

## Основной маршрут и точки слияния

`ep1_arrival` → `ep1_building` → `ep1_first_meet` → **`ep1_choice_first_impression`**

- `ep1_first_impression_warm` → `ep1_move_in`
- `ep1_first_impression_guarded` → `ep1_move_in`
- `ep1_first_impression_cold` → `ep1_move_in`

`ep1_move_in` → `ep1_first_night` → `ep1_university_gate` → `ep1_meet_mina` → `ep1_campus_cafe` → `ep1_reveal_junho` → **`ep1_choice_search_scandal`**

- `ep1_search_deep` → `ep1_scandal_aftertaste`
- `ep1_search_basic` → `ep1_scandal_aftertaste`
- `ep1_search_close` → `ep1_scandal_aftertaste`

`ep1_scandal_aftertaste` → `ep1_return_home` → `ep1_hallway_second_meet` → `ep1_room_settle` → `ep1_soa_ping` → `ep1_soa_first_message` → **`ep1_choice_soa_message`**

- `ep1_soa_tell` → `ep1_after_soa_choice`
- `ep1_soa_hide` → `ep1_after_soa_choice`
- `ep1_soa_reply` → `ep1_after_soa_choice`

`ep1_after_soa_choice` → `ep1_noise_hall` → `ep1_junho_door` → `ep1_junho_warning` → **`ep1_choice_junho_confrontation`**

- `ep1_confront_trust` → `ep1_after_confrontation`
- `ep1_confront_evade` → `ep1_after_confrontation`

`ep1_after_confrontation` → `ep1_old_article_detail` → `ep1_soa_second_ping` → `ep1_soa_photo_intro` → `ep1_old_photo` → **`ep1_choice_photo_response`**

- `ep1_photo_call_junho` → `ep1_end_paywall`
- `ep1_photo_save` → `ep1_end_paywall`
- `ep1_photo_reply` → `ep1_end_paywall`

## Значимые выборы и эффекты

### `ep1_choice_first_impression`
- `ep1_first_warm`: `junhoScore +1`, `first_impression=warm`
- `ep1_first_guarded`: `truthScore +1`, `first_impression=guarded`
- `ep1_first_cold`: `riskScore +1`, `first_impression=cold`

### `ep1_choice_search_scandal`
- `ep1_search_everything`: `truthScore +2`, `riskScore +1`, `deep_scandal_search=true`
- `ep1_search_basics`: `truthScore +1`, `basic_scandal_search=true`
- `ep1_search_stop`: `junhoScore +1`, `avoided_gossip=true`

### `ep1_choice_soa_message`
- `ep1_soa_tell_junho`: `junhoScore +2`, `told_junho_soa=true`
- `ep1_soa_hide_message`: `truthScore +1`, `riskScore +1`, `hid_soa_message=true`
- `ep1_soa_answer`: `truthScore +2`, `riskScore +1`, `replied_soa=true`

### `ep1_choice_junho_confrontation`
- `ep1_confront_trust_choice`: `junhoScore +2`, `trusted_junho_warning=true`
- `ep1_confront_evade_choice`: `truthScore +1`, `riskScore +1`, `evaded_junho=true`

### `ep1_choice_photo_response`
- `ep1_photo_call`: `junhoScore +1`, `photo_called_junho=true`
- `ep1_photo_keep`: `truthScore +1`, `photo_saved=true`
- `ep1_photo_answer`: `riskScore +1`, `photo_replied_soa=true`

## Обязательные сцены

- `ep1_arrival`
- `ep1_first_meet`
- `ep1_reveal_junho`
- `ep1_soa_first_message`
- `ep1_junho_warning`
- `ep1_old_photo`
- `ep1_end_paywall`
