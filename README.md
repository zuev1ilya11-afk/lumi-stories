# LUMI

Telegram Mini App для интерактивных историй. Prototype 0.1 реализует бесплатный первый эпизод истории «Последний онлайн».

## Текущая инфраструктура Prototype 0.1

- Supabase project: `lumi` (`ctgvfjubgxdmhbmhubes`), отдельный от Business OS.
- Supabase Edge Function: `lumi-api` — deployed, ACTIVE (version 3).
- API URL: `https://ctgvfjubgxdmhbmhubes.supabase.co/functions/v1/lumi-api`.
- Netlify project: `lumi-stories` (Free plan), visitor access открыт без team-login.
- Планируемый Mini App URL: `https://lumi-stories.netlify.app`.
- Production-платежей и AI/API-генерации в Prototype 0.1 нет.

## Команды

- `npm run dev` — локальная разработка
- `npm test -- --run` — unit/component tests
- `npm run typecheck` — TypeScript
- `npm run build` — production build
- `npm run e2e` — Playwright
- `npm run validate:story` — проверка графа истории

## Текущий deploy-checkpoint

- Отдельный Supabase `lumi` создан и активен.
- Миграции применены; таблицы `players`, `progress`, `analytics_events` существуют с RLS.
- Прямые `SELECT/INSERT` права для `anon` и `authenticated` отсутствуют.
- `lumi-api` развернут в Supabase и имеет статус ACTIVE.
- Для живого Telegram smoke не хватает только server-side secret `TELEGRAM_BOT_TOKEN`.
- Netlify `lumi-stories` создан на Free-плане, `VITE_LUMI_API_URL` настроен, visitor access открыт.
- Сам frontend ещё не опубликован: sandbox не имеет DNS-доступа к npm registry, поэтому обязательные `npm test/build/e2e` и upload остаются внешним gate.

## Deploy backend

`lumi-api` использует встроенные серверные переменные Supabase (`SUPABASE_URL` и server secret key) и дополнительный secret `TELEGRAM_BOT_TOKEN`.

`TELEGRAM_BOT_TOKEN` нельзя добавлять в Git, `.env.example`, frontend или сообщения. Его нужно сохранить в Supabase Dashboard:

1. Открыть проект `lumi`.
2. Перейти в **Edge Functions → Secrets**.
3. Добавить secret `TELEGRAM_BOT_TOKEN` со значением токена, полученного у `@BotFather`.
4. Повторный deploy функции после добавления secret не требуется — Supabase применяет secrets сразу.

После добавления токена обязательный smoke:

- POST `/bootstrap` с повреждённым/пустым `X-Telegram-Init-Data` → HTTP 401;
- запуск из настоящего Telegram Mini App → `/bootstrap` → HTTP 200;
- выбор в истории → `/progress` сохраняет сцену;
- повторный запуск восстанавливает сохранённую сцену;
- `analytics_events` получает события прохождения.

## Deploy frontend

Netlify использует:

- build command: `npm run build`;
- publish directory: `dist`;
- public build variable `VITE_LUMI_API_URL=https://ctgvfjubgxdmhbmhubes.supabase.co/functions/v1/lumi-api`.

`netlify.toml` не подключает Functions, AI, платные add-ons или сторонние сервисы.

В текущем sandbox npm registry недоступен, поэтому production deploy нельзя считать завершённым, пока в окружении с сетью не пройдут:

```bash
npm ci
npm test -- --run
npm run typecheck
npm run build
npm run e2e
```

После зелёных проверок frontend публикуется в Netlify и полученный HTTPS URL указывается в BotFather как Mini App/menu URL.

## Telegram bot

Создать отдельного бота LUMI через `@BotFather` и настроить кнопку меню на Netlify URL. Токен хранится только как server-side secret Supabase.

## Безопасность

- Таблицы `players`, `progress`, `analytics_events` имеют RLS.
- `anon` и `authenticated` не имеют прямых SELECT/INSERT прав на эти таблицы.
- Идентичность игрока определяется только после server-side проверки Telegram `initData`.
- Server secret Supabase не попадает во frontend.
- Prototype не содержит реальной покупки Stars; paywall лишь измеряет интерес.
