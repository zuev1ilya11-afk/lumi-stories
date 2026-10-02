# LUMI Prototype 0.1 — план реализации

> **Для агентных исполнителей:** ОБЯЗАТЕЛЬНЫЙ ПОДНАВЫК: использовать `superpowers:subagent-driven-development` (предпочтительно) или `superpowers:executing-plans` для выполнения этого плана по задачам. Все шаги отмечаются чекбоксами `- [ ]`.

**Цель:** собрать отдельный Telegram Mini App LUMI с полностью проходимым бесплатным Эпизодом 1 истории «Последний онлайн», реальным сохранением прогресса и аналитикой, но без настоящих платежей и без обязательных ежемесячных расходов.

**Архитектура:** клиент React + TypeScript + Vite запускается как Telegram Mini App и получает `initData`. Один Supabase Edge Function `lumi-api` проверяет Telegram `initData` на каждом запросе и через `service_role` работает с закрытыми таблицами прогресса и аналитики; frontend напрямую к таблицам не обращается. История хранится как структурированные данные и исполняется чистым story engine, чтобы будущие сезоны добавлялись контентом, а не переписыванием UI.

**Технологии:** React, TypeScript, Vite, Vitest, React Testing Library, Playwright, Zod, Supabase Postgres + Edge Functions (Deno), Telegram Mini Apps API, Netlify Free.

**ТЗ:** `docs/superpowers/specs/2026-10-02-lumi-mvp-0-1-design.md` (утверждено пользователем 02.10.2026).

## Глобальные ограничения

- Новый отдельный репозиторий и отдельный Supabase-проект LUMI; никакой зависимости от Business OS.
- Prototype 0.1 содержит только Эпизод 1 и тестовый экран покупки; настоящих Telegram Stars пока нет.
- Эпизод 1 бесплатный и полностью проходимый до клиффхэнгера.
- История хранится как данные, а не внутри React-компонентов.
- Telegram `initDataUnsafe` не используется как подтверждение личности; подпись `initData` проверяется на сервере.
- `service_role`, bot token и другие секреты никогда не попадают во frontend, Git или публичные логи.
- Все записи прогресса и аналитики привязаны только к Telegram ID, полученному из проверенного `initData`.
- Платный тариф хостинга, базы, внешних API или сервисов не подключается без отдельного разрешения пользователя.
- В Prototype 0.1 нет внутренней валюты, подписки, платных выборов, нативных приложений, CMS, AI-чата и production-генерации контента.
- Mobile-first; основной сценарий — запуск внутри Telegram на телефоне.
- Утверждённый визуальный стиль: оригинальный корейский webtoon с лёгким влиянием anime/K-pop/дорам, без копирования реальных айдолов и франшиз.

## Структура файлов

```text
lumi/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── netlify.toml
├── .env.example
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   ├── tokens.css
│   │   └── global.css
│   ├── telegram/
│   │   ├── telegram.ts
│   │   └── telegram.test.ts
│   ├── api/
│   │   ├── client.ts
│   │   └── types.ts
│   ├── story/
│   │   ├── schema.ts
│   │   ├── engine.ts
│   │   ├── engine.test.ts
│   │   ├── validator.ts
│   │   └── validator.test.ts
│   ├── content/
│   │   └── last-online/
│   │       └── season-1/
│   │           ├── episode-1.json
│   │           ├── episode-1.branch-map.md
│   │           └── episode-1.assets.json
│   ├── features/
│   │   ├── shell/
│   │   │   ├── StartScreen.tsx
│   │   │   └── SeasonScreen.tsx
│   │   ├── story/
│   │   │   ├── StoryScreen.tsx
│   │   │   ├── DialogueBox.tsx
│   │   │   ├── ChoiceList.tsx
│   │   │   └── StoryScreen.test.tsx
│   │   ├── messages/
│   │   │   ├── SoaChatScreen.tsx
│   │   │   └── SoaChatScreen.test.tsx
│   │   └── paywall/
│   │       ├── PrototypePaywall.tsx
│   │       └── PrototypePaywall.test.tsx
│   ├── progress/
│   │   ├── model.ts
│   │   ├── useProgress.ts
│   │   └── useProgress.test.tsx
│   └── analytics/
│       ├── events.ts
│       └── events.test.ts
├── public/
│   └── assets/
│       └── last-online/
│           ├── cover.webp
│           ├── characters/
│           │   ├── lera/
│           │   │   ├── neutral.webp
│           │   │   ├── concerned.webp
│           │   │   └── shocked.webp
│           │   └── junho/
│           │       ├── neutral.webp
│           │       ├── guarded.webp
│           │       └── soft.webp
│           ├── backgrounds/
│           │   ├── lera-room-night.webp
│           │   ├── apartment-hallway-night.webp
│           │   ├── hansu-university-day.webp
│           │   └── hansu-street-night.webp
│           └── cg/
│               └── soa-junho-old-photo.webp
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20261002_lumi_prototype.sql
│   └── functions/
│       ├── _shared/
│       │   ├── telegram.ts
│       │   ├── telegram.test.ts
│       │   ├── http.ts
│       │   └── repository.ts
│       └── lumi-api/
│           ├── index.ts
│           ├── routes/
│           │   ├── bootstrap.ts
│           │   ├── progress.ts
│           │   └── analytics.ts
│           └── routes.test.ts
├── scripts/
│   ├── validate-story.ts
│   └── configure-telegram-menu.ts
└── e2e/
    ├── fixtures/telegram.ts
    ├── episode-1.spec.ts
    └── resume-progress.spec.ts
```

## Общие интерфейсы

### StoryState

```ts
export type StoryState = {
  episodeId: string;
  sceneId: string;
  junhoScore: number;
  taeyunScore: number;
  truthScore: number;
  riskScore: number;
  flags: Record<string, boolean | string | number>;
};
```

### ProgressDto

```ts
export type ProgressDto = {
  storyId: 'last-online';
  seasonId: '1';
  state: StoryState;
};

export type SaveProgressInput = ProgressDto;
```

### Story content

```ts
export type Effect =
  | { op: 'inc'; key: 'junhoScore' | 'taeyunScore' | 'truthScore' | 'riskScore'; by: number }
  | { op: 'setFlag'; key: string; value: boolean | string | number };

export type Condition =
  | { op: 'gte'; key: 'junhoScore' | 'taeyunScore' | 'truthScore' | 'riskScore'; value: number }
  | { op: 'flagEquals'; key: string; value: boolean | string | number };

export type Choice = {
  id: string;
  text: string;
  effects: Effect[];
  nextSceneId: string;
  conditions?: Condition[];
};

export type Scene = {
  id: string;
  kind: 'narration' | 'dialogue' | 'choice' | 'chat' | 'end';
  background?: string;
  character?: { id: 'lera' | 'junho'; expression: string };
  speaker?: string;
  text?: string;
  nextSceneId?: string;
  choices?: Choice[];
  chatMessages?: Array<{ sender: 'SOA' | 'LERA'; text: string; time: string }>;
};

export type Episode = {
  id: string;
  title: string;
  startSceneId: string;
  terminalSceneId: string;
  scenes: Scene[];
};
```

### API

Все запросы к backend содержат заголовок:

`X-Telegram-Init-Data: <Telegram.WebApp.initData>`

Маршруты единственной Edge Function:

- `POST /functions/v1/lumi-api/bootstrap`
- `GET /functions/v1/lumi-api/progress?storyId=last-online&seasonId=1`
- `PUT /functions/v1/lumi-api/progress`
- `POST /functions/v1/lumi-api/analytics`

## Review Focus

1. **Поддельный или просроченный Telegram `initData`:** backend должен вернуть 401 и не создавать игрока, прогресс или событие аналитики.
2. **Двойное нажатие на вариант ответа:** один выбор должен примениться ровно один раз; UI блокирует повторный выбор до завершения сохранения.
3. **Обрыв сети во время сохранения:** текущая сцена не должна визуально перескочить вперёд без подтверждённого сохранения; игрок получает retry и может безопасно повторить действие.
4. **Повторное открытие Mini App на другом устройстве:** серверный прогресс должен восстановить ту же сцену и те же очки/флаги.
5. **Повреждённый контент истории:** отсутствующий `nextSceneId`, недостижимая обязательная сцена или путь без терминальной сцены должны ломать validation/build, а не проявляться у пользователя.

---

### Task 1: Создать отдельный репозиторий LUMI и базовые quality gates

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Consumes: утверждённое ТЗ.
- Produces: запускаемый React + TypeScript + Vite проект с командами `dev`, `test`, `typecheck`, `build`, `e2e`.

- [ ] **Step 1: Создать новый отдельный GitHub-репозиторий `lumi` без кода Business OS**

Проверка: `git remote -v` указывает только на новый репозиторий LUMI.

- [ ] **Step 2: Инициализировать Vite React TypeScript и установить минимальные зависимости**

Нужны runtime-зависимости: `react`, `react-dom`, `zod`.

Нужны dev-зависимости: `vite`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`.

- [ ] **Step 3: Добавить smoke-тест приложения**

`src/App.test.tsx`:

```ts
it('renders the LUMI shell', () => {
  render(<App />);
  expect(screen.getByText('LUMI')).toBeInTheDocument();
});
```

- [ ] **Step 4: Запустить unit test и убедиться, что он сначала падает**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL до реализации shell.

- [ ] **Step 5: Реализовать минимальный shell LUMI**

`App` должен показывать бренд `LUMI` и не содержать продуктовой логики.

- [ ] **Step 6: Запустить базовые проверки**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
```

Expected: все команды exit 0.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold lumi prototype"
```

---

### Task 2: Telegram runtime и безопасный запуск Mini App

**Files:**
- Create: `src/telegram/telegram.ts`
- Create: `src/telegram/telegram.test.ts`
- Modify: `src/App.tsx`
- Create: `scripts/configure-telegram-menu.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `window.Telegram.WebApp` при реальном запуске; в browser dev mode допускается только явный non-production mock.
- Produces: `getTelegramContext(): { initData: string; userDisplayName?: string }` и `readyTelegramApp(): void`.

- [ ] **Step 1: Написать тесты Telegram adapter**

Проверить:
- возвращается точный `initData` из Telegram SDK;
- `userDisplayName` берётся только для отображения и никогда не считается доказательством личности;
- production mode без `initData` возвращает контролируемую ошибку `TELEGRAM_CONTEXT_REQUIRED`.

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test -- --run src/telegram/telegram.test.ts`
Expected: FAIL — adapter ещё не реализован.

- [ ] **Step 3: Реализовать `getTelegramContext()` и `readyTelegramApp()`**

Не отправлять `initDataUnsafe.user.id` как доверенный user ID. Клиент передаёт серверу только исходную строку `initData`.

- [ ] **Step 4: Добавить экран ошибки «Откройте LUMI из Telegram»**

Он показывается только когда production build открыт вне Telegram.

- [ ] **Step 5: Добавить `scripts/configure-telegram-menu.ts`**

Интерфейс:

```ts
configureTelegramMenu(botToken: string, miniAppUrl: string): Promise<void>
```

Скрипт вызывает официальный Bot API `setChatMenuButton`; token читается только из переменной окружения `TELEGRAM_BOT_TOKEN`.

- [ ] **Step 6: Проверить**

Run:

```bash
npm test -- --run src/telegram/telegram.test.ts
npm run typecheck
```

Expected: PASS / exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/telegram src/App.tsx scripts/configure-telegram-menu.ts .env.example
git commit -m "feat: add telegram mini app runtime"
```

---

### Task 3: Серверная проверка Telegram `initData` и bootstrap игрока

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/functions/_shared/telegram.ts`
- Create: `supabase/functions/_shared/telegram.test.ts`
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/functions/lumi-api/index.ts`
- Create: `supabase/functions/lumi-api/routes/bootstrap.ts`
- Create: `supabase/functions/lumi-api/routes.test.ts`

**Interfaces:**
- Consumes: HTTP header `X-Telegram-Init-Data`, secret `TELEGRAM_BOT_TOKEN`.
- Produces: `verifyTelegramInitData(initData: string, botToken: string, nowSeconds: number): VerifiedTelegramUser`.
- Produces route: `POST /bootstrap -> { playerId, telegramUserId, season1Owned, progress }`.

`VerifiedTelegramUser`:

```ts
export type VerifiedTelegramUser = {
  id: number;
  firstName?: string;
  username?: string;
  authDate: number;
};
```

- [ ] **Step 1: Написать криптографические тесты `verifyTelegramInitData`**

Тесты обязательно покрывают:
- корректно подписанный payload принимается;
- один изменённый символ в `user` отклоняется;
- неверный `hash` отклоняется;
- `auth_date` старше 24 часов отклоняется;
- отсутствие `user.id` отклоняется.

Для теста подпись генерируется самим тестовым helper по официальному алгоритму Telegram, а не хардкодится из production.

- [ ] **Step 2: Запустить Deno test и увидеть FAIL**

Run: `deno test supabase/functions/_shared/telegram.test.ts`
Expected: FAIL — verifier не реализован.

- [ ] **Step 3: Реализовать `verifyTelegramInitData(...)`**

Максимальный возраст Prototype: `86400` секунд. Сравнение подписи выполняется constant-time способом.

- [ ] **Step 4: Настроить `lumi-api` как custom-auth function**

В `supabase/config.toml`:

```toml
[functions.lumi-api]
verify_jwt = false
```

Каждый route handler самостоятельно вызывает Telegram verifier до любой работы с БД.

- [ ] **Step 5: Написать route tests bootstrap**

Проверить 401 при invalid initData и 200 при valid initData с repository mock.

- [ ] **Step 6: Реализовать bootstrap route через dependency-injected repository**

В этом task repository может быть in-memory fake; настоящая БД подключается в Task 4.

- [ ] **Step 7: Проверить**

Run:

```bash
deno test supabase/functions/_shared/telegram.test.ts supabase/functions/lumi-api/routes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase
git commit -m "feat: verify telegram mini app identity"
```

---

### Task 4: Схема БД, безопасный repository и серверный прогресс

**Files:**
- Create: `supabase/migrations/20261002_lumi_prototype.sql`
- Create: `supabase/functions/_shared/repository.ts`
- Create: `supabase/functions/lumi-api/routes/progress.ts`
- Modify: `supabase/functions/lumi-api/index.ts`
- Modify: `supabase/functions/lumi-api/routes.test.ts`
- Create: `src/api/client.ts`
- Create: `src/api/types.ts`

**Interfaces:**
- Consumes: verified Telegram ID from Task 3.
- Produces repository methods:
  - `getOrCreatePlayer(telegramUserId: number): Promise<Player>`
  - `getProgress(playerId: string, storyId: string, seasonId: string): Promise<Progress | null>`
  - `saveProgress(playerId: string, input: SaveProgressInput): Promise<Progress>`
- Produces frontend methods:
  - `bootstrap(initData: string): Promise<BootstrapResponse>`
  - `loadProgress(initData: string): Promise<ProgressDto | null>`
  - `saveProgress(initData: string, progress: ProgressDto): Promise<ProgressDto>`

- [ ] **Step 1: Создать migration с `players`, `progress`, `analytics_events`**

`players`:
- `id uuid primary key default gen_random_uuid()`;
- `telegram_user_id bigint unique not null`;
- `season_1_owned boolean not null default false`;
- `created_at timestamptz not null default now()`.

`progress`:
- unique `(player_id, story_id, season_id)`;
- scores integer default 0;
- `flags jsonb not null default '{}'::jsonb`;
- `updated_at timestamptz`.

`analytics_events` добавляется сейчас, маршрут — в Task 10.

- [ ] **Step 2: Включить RLS и закрыть прямой клиентский доступ**

Для всех трёх таблиц:
- `enable row level security`;
- не создавать anon/authenticated policies;
- `revoke all` для `anon` и `authenticated`;
- backend использует только server-side service role.

- [ ] **Step 3: Написать repository tests через mock database adapter**

Проверить:
- один Telegram ID не создаёт двух игроков;
- `saveProgress` upsert-ит ровно одну запись на story/season;
- нельзя передать другой `player_id` из клиента — он определяется handler-ом по verified Telegram ID.

- [ ] **Step 4: Реализовать repository**

`service_role` читается только из runtime environment Edge Function.

- [ ] **Step 5: Написать route tests progress**

Проверить GET пустого прогресса, PUT + повторный GET, 401 на invalid initData.

- [ ] **Step 6: Реализовать `/progress` GET/PUT**

`PUT` принимает только story state; `player_id`, Telegram ID и `season_1_owned` из body игнорируются/запрещаются schema validation.

- [ ] **Step 7: Реализовать frontend API client**

Все методы ставят `X-Telegram-Init-Data`; base URL берётся из `VITE_LUMI_API_URL`.

- [ ] **Step 8: Проверить**

Run:

```bash
deno test supabase/functions/lumi-api/routes.test.ts
npm test -- --run
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase src/api
git commit -m "feat: persist verified player progress"
```

---

### Task 5: Story schema, pure engine и автоматическая проверка веток

**Files:**
- Create: `src/story/schema.ts`
- Create: `src/story/engine.ts`
- Create: `src/story/engine.test.ts`
- Create: `src/story/validator.ts`
- Create: `src/story/validator.test.ts`
- Create: `scripts/validate-story.ts`

**Interfaces:**
- Consumes: `Episode`, `StoryState` из общих интерфейсов.
- Produces:
  - `parseEpisode(raw: unknown): Episode`
  - `getScene(episode: Episode, sceneId: string): Scene`
  - `getAvailableChoices(scene: Scene, state: StoryState): Choice[]`
  - `applyChoice(state: StoryState, choice: Choice): StoryState`
  - `resolveNextScene(scene: Scene, state: StoryState): string | null`
  - `validateEpisode(episode: Episode): ValidationIssue[]`
  - `enumeratePaths(episode: Episode, initialState: StoryState): PathResult[]`

- [ ] **Step 1: Написать schema tests**

Проверить отказ на:
- неизвестный `kind`;
- choice без `nextSceneId`;
- `inc` по неизвестной score-переменной;
- пустой scene id.

- [ ] **Step 2: Написать engine tests**

Обязательные assertions:

```ts
expect(applyChoice(initial, choice).junhoScore).toBe(initial.junhoScore + 2);
expect(applyChoice(initial, choice).flags.trusted_junho).toBe(true);
```

Дополнительно проверить conditions и недоступные choices.

- [ ] **Step 3: Написать validator tests для Review Focus #5**

Проверить:
- ссылка на отсутствующую сцену -> issue;
- обязательная недостижимая сцена -> issue;
- маршрут без terminal -> issue;
- корректный мини-эпизод -> 0 issues.

- [ ] **Step 4: Запустить тесты и увидеть FAIL**

Run: `npm test -- --run src/story`
Expected: FAIL.

- [ ] **Step 5: Реализовать schema + engine + validator**

Engine — чистые функции без React, Telegram и network.

- [ ] **Step 6: Реализовать `scripts/validate-story.ts`**

Run format:

```bash
npm run validate:story -- src/content/last-online/season-1/episode-1.json
```

Exit 0 только если schema и graph validation проходят.

- [ ] **Step 7: Проверить**

Run:

```bash
npm test -- --run src/story
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/story scripts/validate-story.ts package.json
git commit -m "feat: add reusable branching story engine"
```

---

### Task 6: Написать полностью Эпизод 1 в формате движка

**Files:**
- Create: `src/content/last-online/season-1/episode-1.json`
- Create: `src/content/last-online/season-1/episode-1.branch-map.md`
- Create: `src/content/last-online/season-1/episode-1.assets.json`
- Modify: `src/story/validator.test.ts`

**Interfaces:**
- Consumes: Story schema и engine из Task 5; канон из утверждённого ТЗ.
- Produces: `episode-1.json`, который проходит `parseEpisode`, `validateEpisode` и полное перечисление путей.

- [ ] **Step 1: Зафиксировать пять значимых choice nodes Эпизода 1**

ID и назначение:
- `ep1_choice_first_impression` — первый тон общения с Джунхо;
- `ep1_choice_search_scandal` — насколько глубоко Лера лезет в старый скандал;
- `ep1_choice_soa_message` — рассказать Джунхо / скрыть / ответить SOA;
- `ep1_choice_junho_confrontation` — довериться Джунхо или уклониться;
- `ep1_choice_photo_response` — реакция на финальную фотографию без изменения самого клиффхэнгера.

- [ ] **Step 2: Написать `episode-1.branch-map.md` до полного текста**

Документ перечисляет все scene IDs, места объединения веток и эффекты. Каждый из пяти выборов должен менять хотя бы один score/flag или доступную сцену.

- [ ] **Step 3: Написать полный Scene Script Эпизода 1**

Целевая длительность чтения: 10–15 минут.

Обязательные сюжетные точки:
- приезд Леры в Хансу;
- первая встреча с Джунхо;
- университет и раскрытие его прошлого;
- первое сообщение SOA;
- выбор `рассказать / скрыть / ответить`;
- нарастание подозрения;
- финальная старая фотография Соа и Джунхо из квартиры Леры;
- переход в `ep1_end_paywall`.

- [ ] **Step 4: Создать `episode-1.assets.json`**

Каждый scene asset ref должен существовать в заранее зафиксированном наборе Prototype:
- 4 backgrounds;
- Lera: neutral/concerned/shocked;
- Junho: neutral/guarded/soft;
- 1 CG `soa-junho-old-photo`.

- [ ] **Step 5: Добавить content tests**

Assertions:
- 5 choice nodes существуют;
- `ep1_choice_soa_message` содержит ровно 3 варианта с ожидаемыми flag effects;
- каждый полный путь приходит в `ep1_end_paywall`;
- существует минимум два разных достижимых состояния `junhoScore/truthScore` к финалу;
- нет недостижимых обязательных сцен.

- [ ] **Step 6: Проверить Episode 1**

Run:

```bash
npm run validate:story -- src/content/last-online/season-1/episode-1.json
npm test -- --run src/story
```

Expected: validation 0 issues; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/content src/story/validator.test.ts
git commit -m "feat: author last online episode one"
```

---

### Task 7: Подготовить Prototype art pack и визуальную оболочку

**Files:**
- Create: `public/assets/last-online/cover.webp`
- Create: `public/assets/last-online/characters/lera/*.webp`
- Create: `public/assets/last-online/characters/junho/*.webp`
- Create: `public/assets/last-online/backgrounds/*.webp`
- Create: `public/assets/last-online/cg/soa-junho-old-photo.webp`
- Create: `src/features/shell/StartScreen.tsx`
- Create: `src/features/shell/SeasonScreen.tsx`
- Create: `src/features/story/DialogueBox.tsx`
- Create: `src/features/story/ChoiceList.tsx`
- Create: `src/features/story/StoryScreen.tsx`
- Create: `src/features/story/StoryScreen.test.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: approved visual direction + Episode 1 asset registry + Story Engine.
- Produces: mobile-first story renderer; `StoryScreen` получает `{ episode, state, onChoose, onAdvance }`.

- [ ] **Step 1: Зафиксировать art pack только для реально используемых сцен Эпизода 1**

Не создавать assets для Эпизодов 2–5.

Все изображения — оригинальные. Existing approved concept art используется только как style/continuity reference; runtime assets создаются как чистые game assets без лишней типографики.

- [ ] **Step 2: Написать StoryScreen tests**

Проверить:
- dialogue scene показывает speaker/text/background;
- choice scene показывает только доступные choices;
- после первого клика choice buttons disabled до завершения `onChoose`;
- повторный клик не вызывает `onChoose` второй раз (Review Focus #2).

- [ ] **Step 3: Запустить тест и увидеть FAIL**

Run: `npm test -- --run src/features/story/StoryScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Реализовать StartScreen и SeasonScreen**

SeasonScreen показывает:
- Эпизод 1 — бесплатно;
- Эпизоды 2–5 — замок;
- кнопку `Начать` или `Продолжить` в зависимости от server progress.

- [ ] **Step 5: Реализовать StoryScreen, DialogueBox, ChoiceList**

Во время чтения нет постоянной нижней навигации. Верхний UI минимален: episode label + menu button.

- [ ] **Step 6: Реализовать mobile CSS tokens**

Минимальная целевая ширина: 320 CSS px. Проверить safe-area Insets Telegram/iOS.

- [ ] **Step 7: Проверить unit + visual smoke**

Run:

```bash
npm test -- --run src/features/story/StoryScreen.test.tsx
npm run typecheck
npm run build
```

Expected: PASS / exit 0.

- [ ] **Step 8: Commit**

```bash
git add public/assets src/features src/styles src/App.tsx
git commit -m "feat: build lumi visual novel interface"
```

---

### Task 8: Реализовать режим переписки SOA

**Files:**
- Create: `src/features/messages/SoaChatScreen.tsx`
- Create: `src/features/messages/SoaChatScreen.test.tsx`
- Modify: `src/features/story/StoryScreen.tsx`

**Interfaces:**
- Consumes: `Scene` с `kind: 'chat'`.
- Produces: `SoaChatScreen({ scene, availableChoices, onChoose })`.

- [ ] **Step 1: Написать тесты SOA chat**

Проверить:
- имя `SOA`;
- статус «была в сети очень давно»;
- сообщения «Ты живёшь напротив него?» и «Не говори Джунхо, что я тебе написала.» в соответствующей scene fixture;
- choice replies работают через тот же engine callback;
- attachment image отображается в финальной chat-сцене, если asset указан.

- [ ] **Step 2: Запустить test и увидеть FAIL**

Run: `npm test -- --run src/features/messages/SoaChatScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать chat UI**

Не имитировать реальный Telegram чат; это внутриигровая стилизованная переписка LUMI.

- [ ] **Step 4: Подключить `kind: 'chat'` в StoryScreen**

- [ ] **Step 5: Проверить**

Run:

```bash
npm test -- --run src/features/messages/SoaChatScreen.test.tsx src/features/story/StoryScreen.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/messages src/features/story/StoryScreen.tsx
git commit -m "feat: add soa messaging scenes"
```

---

### Task 9: Автосохранение, безопасный выбор и восстановление прогресса

**Files:**
- Create: `src/progress/model.ts`
- Create: `src/progress/useProgress.ts`
- Create: `src/progress/useProgress.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/story/StoryScreen.tsx`

**Interfaces:**
- Consumes: Task 4 API client + Task 5 engine.
- Produces hook:

```ts
useProgress(initData: string): {
  status: 'loading' | 'ready' | 'saving' | 'error';
  state: StoryState | null;
  choose(choiceId: string): Promise<void>;
  advance(): Promise<void>;
  retry(): Promise<void>;
}
```

- [ ] **Step 1: Написать hook tests для save-before-advance**

Review Focus #3:
- API save rejected -> visible scene ID остаётся прежним;
- status становится `error`;
- retry повторяет тот же save;
- успешный save -> scene меняется ровно один раз.

Review Focus #4:
- bootstrap с сохранённым progress -> hook стартует с серверной scene/state, а не с episode start.

- [ ] **Step 2: Запустить test и увидеть FAIL**

Run: `npm test -- --run src/progress/useProgress.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать `useProgress`**

Правило: effect + next state вычисляются локально, но UI commit следующей сцены происходит только после успешного server save.

- [ ] **Step 4: Подключить к App/StoryScreen**

На `saving` choice buttons disabled; на `error` показывается компактная плашка «Не удалось сохранить. Повторить».

- [ ] **Step 5: Проверить**

Run:

```bash
npm test -- --run src/progress/useProgress.test.tsx src/features/story/StoryScreen.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/progress src/App.tsx src/features/story/StoryScreen.tsx
git commit -m "feat: autosave and resume story progress"
```

---

### Task 10: События продуктовой аналитики

**Files:**
- Create: `src/analytics/events.ts`
- Create: `src/analytics/events.test.ts`
- Create: `supabase/functions/lumi-api/routes/analytics.ts`
- Modify: `supabase/functions/lumi-api/index.ts`
- Modify: `supabase/functions/lumi-api/routes.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/progress/useProgress.ts`

**Interfaces:**
- Consumes: verified Telegram player + scene/choice state.
- Produces:

```ts
trackEvent(name: AnalyticsEventName, metadata?: Record<string, unknown>): Promise<void>
```

Allowed names:
- `app_opened`
- `episode_started`
- `scene_reached`
- `choice_selected`
- `episode_finished`
- `paywall_opened`
- `purchase_clicked`
- `replay_started`

`purchase_success` и `season_finished` зарезервированы для MVP 1.0 и в Prototype не генерируются.

- [ ] **Step 1: Написать frontend event allowlist tests**

Unknown event name не отправляется.

- [ ] **Step 2: Написать backend analytics route tests**

Проверить:
- invalid Telegram auth -> 401;
- неизвестный event -> 400;
- metadata превышает допустимый размер -> 400;
- валидное событие получает verified player ID на сервере.

- [ ] **Step 3: Реализовать backend route**

Не принимать `player_id` из клиента.

- [ ] **Step 4: Реализовать frontend tracking**

Analytics failure не должен ломать чтение истории; ошибка пишется только в non-sensitive diagnostic log.

- [ ] **Step 5: Подключить события в lifecycle**

Не отправлять `scene_reached` повторно при лишнем React render; использовать scene transition как триггер.

- [ ] **Step 6: Проверить**

Run:

```bash
npm test -- --run src/analytics
deno test supabase/functions/lumi-api/routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/analytics src/App.tsx src/progress supabase/functions/lumi-api
git commit -m "feat: track lumi prototype analytics"
```

---

### Task 11: Тестовый paywall конца Эпизода 1

**Files:**
- Create: `src/features/paywall/PrototypePaywall.tsx`
- Create: `src/features/paywall/PrototypePaywall.test.tsx`
- Modify: `src/features/story/StoryScreen.tsx`
- Modify: `src/analytics/events.ts`

**Interfaces:**
- Consumes: terminal scene `ep1_end_paywall`.
- Produces: paywall UI без настоящей оплаты.

- [ ] **Step 1: Написать tests paywall**

Обязательный текст:
- `История только начинается`;
- `Эпизоды 2–5`;
- ориентир `249 ₽` помечен как будущая цена/тест предложения, а не как работающий рублёвый платёж внутри Telegram.

Кнопка `Продолжить` в Prototype:
- отправляет `purchase_clicked`;
- показывает сообщение `Покупка появится в полной версии`;
- не выдаёт доступ и не вызывает Telegram invoice.

- [ ] **Step 2: Запустить test и увидеть FAIL**

Run: `npm test -- --run src/features/paywall/PrototypePaywall.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать paywall**

Экран появляется только после `episode_finished` и финального CG.

- [ ] **Step 4: Проверить**

Run:

```bash
npm test -- --run src/features/paywall/PrototypePaywall.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/paywall src/features/story/StoryScreen.tsx src/analytics/events.ts
git commit -m "feat: add prototype season paywall"
```

---

### Task 12: Сквозные тесты Telegram → история → сохранение → paywall

**Files:**
- Create: `e2e/fixtures/telegram.ts`
- Create: `e2e/episode-1.spec.ts`
- Create: `e2e/resume-progress.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: весь Prototype stack.
- Produces: deterministic Playwright tests с валидно подписанным тестовым Telegram `initData`.

- [ ] **Step 1: Создать Telegram E2E fixture**

Fixture генерирует корректно подписанный `initData` с test bot token и до загрузки страницы ставит mock `window.Telegram.WebApp.initData`.

Никакого production auth bypass в приложении не добавлять.

- [ ] **Step 2: Написать `episode-1.spec.ts`**

Сценарий:
1. открыть app;
2. начать Эпизод 1;
3. сделать один из маршрутов, включая `Скрыть сообщение`;
4. дойти до старой фотографии;
5. увидеть paywall;
6. убедиться, что `purchase_clicked` не разблокирует главы.

- [ ] **Step 3: Написать `resume-progress.spec.ts`**

Сценарий:
1. пройти до середины;
2. закрыть page/context;
3. открыть с тем же Telegram ID;
4. нажать `Продолжить`;
5. увидеть сохранённую scene и сохранённые значения state.

- [ ] **Step 4: Добавить network-failure сценарий**

При отказе PUT progress UI остаётся на текущей сцене, показывает retry; после восстановления network retry проходит один раз.

- [ ] **Step 5: Запустить E2E**

Run: `npm run e2e`
Expected: all specs PASS.

- [ ] **Step 6: Полный regression gate**

Run:

```bash
npm test -- --run
npm run typecheck
npm run validate:story -- src/content/last-online/season-1/episode-1.json
npm run build
npm run e2e
```

Expected: все команды exit 0.

- [ ] **Step 7: Commit**

```bash
git add e2e playwright.config.ts
git commit -m "test: cover lumi prototype end to end"
```

---

### Task 13: Бесплатный deploy Prototype и реальный запуск из Telegram

**Files:**
- Create: `netlify.toml`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: GitHub repo, Netlify Free, отдельный Supabase Free, Telegram bot token.
- Produces: production-like Prototype URL, открываемый из Telegram Bot menu button.

- [ ] **Step 1: Перед созданием инфраструктуры повторно проверить бесплатные тарифы**

Подтвердить на дату deploy, что выбранные Netlify и Supabase планы позволяют закрытый Prototype без обязательного платного тарифа и без автоматического overage. Если условия изменились — остановить deploy и выбрать другой бесплатный вариант, не подключая оплату самостоятельно.

- [ ] **Step 2: Создать отдельный Supabase Free project LUMI**

Не использовать project Business OS.

- [ ] **Step 3: Применить migration**

После применения проверить вручную/SQL:
- таблицы существуют;
- RLS enabled;
- anon/authenticated не имеют прямого доступа.

- [ ] **Step 4: Настроить Edge Function secrets**

Только server-side:
- `TELEGRAM_BOT_TOKEN`;
- Supabase server env/service role.

- [ ] **Step 5: Deploy `lumi-api` и выполнить smoke запросы**

Invalid initData -> 401.
Valid test initData -> bootstrap 200.

- [ ] **Step 6: Deploy frontend на Netlify Free**

`netlify.toml` не включает платные add-ons.

- [ ] **Step 7: Создать/настроить Telegram bot и menu button на Netlify URL**

Token не писать в чат, Git или README; использовать локальную/защищённую env.

- [ ] **Step 8: Проверить на реальном телефоне внутри Telegram**

Обязательные проверки:
- app открывается из bot menu;
- LUMI не показывает ошибку Telegram context;
- новая игра стартует;
- choice сохраняется;
- app закрывается;
- повторный запуск продолжает со старой сцены;
- финальный paywall появляется;
- в `analytics_events` есть соответствующие события.

- [ ] **Step 9: Проверить мобильную сеть и медленное соединение**

Не считать Prototype готовым, если он работает только на Wi‑Fi разработчика.

- [ ] **Step 10: Проверить отсутствие расходов**

Зафиксировать:
- Netlify plan = Free;
- Supabase plan = Free;
- нет подключённых платных add-ons;
- нет AI/API вызовов во время обычного прохождения игры.

- [ ] **Step 11: Commit deploy docs**

```bash
git add netlify.toml README.md .env.example
git commit -m "docs: add lumi prototype deployment"
```

---

### Task 14: Закрытый тест и решение о переходе к MVP 1.0

**Files:**
- Create: `docs/testing/prototype-0-1-test-plan.md`
- Create: `docs/testing/prototype-0-1-results.md`

**Interfaces:**
- Consumes: deployed Prototype + raw analytics.
- Produces: решение `ITERATE_EPISODE_1` или `PROCEED_TO_MVP_1_0`, основанное на фактах.

- [ ] **Step 1: Составить небольшой тестовый набор пользователей из целевой аудитории**

Не использовать накрученный трафик. Цель первого закрытого теста — найти проблемы темпа, UI и понимания выбора, а не доказать market fit.

- [ ] **Step 2: Зафиксировать вопросы теста**

Минимум:
- где стало скучно/непонятно;
- хотелось ли узнать продолжение после фотографии;
- кому из Джунхо/Тэюна интереснее доверять по первым впечатлениям;
- замечали ли, что выборы влияют на историю;
- возникли ли проблемы с Telegram/загрузкой/сохранением.

- [ ] **Step 3: Собрать фактические продуктовые данные**

Минимум:
- opens;
- episode_started;
- episode_finished;
- paywall_opened;
- purchase_clicked;
- drop-off scenes.

- [ ] **Step 4: Записать результаты без придумывания порогов задним числом**

Отдельно разделить qualitative feedback и фактическую аналитику.

- [ ] **Step 5: Принять решение**

`ITERATE_EPISODE_1` если проблема в сюжете, UX, сохранении или темпе.

`PROCEED_TO_MVP_1_0` только если Prototype технически стабилен и есть реальный сигнал интереса к продолжению.

- [ ] **Step 6: Commit test report**

```bash
git add docs/testing
git commit -m "docs: record lumi prototype validation"
```

---

## Финальный gate Prototype 0.1

Перед утверждением Prototype как завершённого выполнить свежо, в одном рабочем состоянии:

```bash
npm test -- --run
npm run typecheck
npm run validate:story -- src/content/last-online/season-1/episode-1.json
npm run build
npm run e2e
```

И вручную подтвердить на реальном Telegram-клиенте:

- запуск из бота;
- проверенную идентификацию;
- полное прохождение Эпизода 1;
- сохранение и восстановление;
- SOA chat;
- финальный CG;
- тестовый paywall;
- запись аналитики;
- отсутствие платной инфраструктуры;
- отсутствие любой зависимости от Business OS.

Только после этого можно говорить «Prototype 0.1 готов».

## Что сознательно переносится в отдельный план MVP 1.0

Не реализовывать в рамках этого плана:

- Telegram Stars invoices и `successful_payment`;
- `purchases` table и refund flow;
- server-side entitlement для платных Эпизодов 2–5;
- сами Эпизоды 2–5;
- три финальных концовки;
- `purchase_success` и `season_finished` events;
- share-card концовки;
- production QA всех платных маршрутов.

Для этого после закрытого теста создаётся отдельный план `LUMI MVP 1.0` на основании реальных данных Prototype 0.1.
