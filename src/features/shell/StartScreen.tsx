import { useState } from 'react';
import { publicAsset } from '../../publicAsset';
import { STORY_CATALOG } from '../../story/catalog';

type StartScreenProps = {
  onStart(): void;
  onOpenStory?(storyId: string): void;
  userDisplayName?: string;
  hasProgress?: boolean;
  currentEpisodeId?: string;
  season1Owned?: boolean;
  season1PriceStars?: number;
};

type StartTab = 'home' | 'stories' | 'profile' | 'settings';

const FEATURES = [
  ['♡', 'Любовные линии'],
  ['◈', 'Неожиданные повороты'],
  ['⌁', 'Твои решения имеют значение'],
  ['✦', 'Новые истории каждую неделю'],
] as const;

function episodeLabel(id?: string): string {
  return id === 'last-online-s1-e2' ? 'Эпизод 2' : 'Эпизод 1';
}

function Navigation({ tab, onTab }: { tab: StartTab; onTab(tab: StartTab): void }) {
  return (
    <nav className="lumi-start__nav" aria-label="Навигация LUMI">
      <button type="button" className={tab === 'stories' ? 'is-active' : ''} aria-current={tab === 'stories' ? 'page' : undefined} onClick={() => onTab('stories')}>
        <span aria-hidden="true">▱</span>
        Истории
      </button>
      <button type="button" className={tab === 'profile' ? 'is-active' : ''} aria-current={tab === 'profile' ? 'page' : undefined} onClick={() => onTab('profile')}>
        <span aria-hidden="true">○</span>
        Профиль
      </button>
      <button type="button" className={tab === 'settings' ? 'is-active' : ''} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => onTab('settings')}>
        <span aria-hidden="true">⚙</span>
        Настройки
      </button>
    </nav>
  );
}

export function StartScreen({
  onStart,
  onOpenStory,
  userDisplayName = 'Игрок LUMI',
  hasProgress = false,
  currentEpisodeId = 'last-online-s1-e1',
  season1Owned = false,
  season1PriceStars = 149,
}: StartScreenProps) {
  const [tab, setTab] = useState<StartTab>('home');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  function openStory(storyId: string) {
    if (onOpenStory) {
      onOpenStory(storyId);
      return;
    }
    if (storyId === 'last-online') onStart();
  }

  return (
    <main className={`lumi-start lumi-start--minimal${motionEnabled ? '' : ' is-calm'}`} aria-label="LUMI">
      <div className="lumi-start__stars" aria-hidden="true" />
      <div className="lumi-start__moon" aria-hidden="true" />
      <div className="lumi-start__horizon" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>

      {tab === 'home' ? (
        <section className="lumi-start__minimal-content">
          <div className="lumi-start__brand-block">
            <h1 className="lumi-logo lumi-logo--minimal">LUMI</h1>
            <p className="lumi-start__subtitle">Больше, чем истории</p>
          </div>

          <div className="lumi-start__features" aria-label="Возможности LUMI">
            {FEATURES.map(([icon, label]) => (
              <div className="lumi-start__feature" key={label}>
                <span aria-hidden="true">{icon}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>

          <button className="lumi-start__cta" type="button" aria-label={hasProgress ? 'Продолжить историю' : 'Начать историю'} onClick={onStart}>
            <span aria-hidden="true">▷</span>
            {hasProgress ? 'Продолжить' : 'Начать'}
          </button>
        </section>
      ) : null}

      {tab === 'stories' ? (
        <section className="lumi-start__panel lumi-stories-library" aria-label="Истории">
          <p className="lumi-eyebrow">Библиотека</p>
          <h1>Истории</h1>
          <p className="lumi-start__panel-muted">Все истории LUMI будут собраны здесь.</p>

          <div className="lumi-story-catalog">
            {STORY_CATALOG.map(story => {
              const isCurrentStory = story.id === 'last-online';
              const progressLabel = isCurrentStory
                ? (hasProgress ? `${episodeLabel(currentEpisodeId)} · продолжить` : 'Эпизод 1 · бесплатно')
                : story.seasonLabel;

              return (
                <button
                  className={`lumi-story-card${story.available ? '' : ' is-coming'}`}
                  type="button"
                  key={story.id}
                  disabled={!story.available}
                  aria-label={story.available ? `Открыть историю «${story.title}»` : `История «${story.title}» скоро`}
                  onClick={() => openStory(story.id)}
                >
                  <span
                    className="lumi-story-card__cover"
                    aria-hidden="true"
                    style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(7,5,12,.82) 100%), url(${publicAsset(story.coverAsset)})` }}
                  />
                  <span className="lumi-story-card__body">
                    <small>{story.seasonLabel}</small>
                    <strong>{story.title}</strong>
                    <span>{story.description}</span>
                    <b>{story.available ? progressLabel : 'Скоро'}</b>
                  </span>
                  <span className="lumi-story-card__arrow" aria-hidden="true">{story.available ? '→' : '⌁'}</span>
                </button>
              );
            })}
          </div>

          <p className="lumi-story-catalog__note">Новые истории будут автоматически появляться в этой библиотеке.</p>
        </section>
      ) : null}

      {tab === 'profile' ? (
        <section className="lumi-start__panel" aria-label="Профиль">
          <p className="lumi-eyebrow">Профиль</p>
          <div className="lumi-profile__avatar" aria-hidden="true">{userDisplayName.slice(0, 1).toUpperCase()}</div>
          <h1>{userDisplayName}</h1>
          <p className="lumi-start__panel-muted">Твои истории и прогресс LUMI</p>

          <div className="lumi-start__cards">
            <article className="lumi-start__card">
              <small>Текущая история</small>
              <strong>Последний онлайн</strong>
              <span>{episodeLabel(currentEpisodeId)} · {hasProgress ? 'в процессе' : 'не начато'}</span>
            </article>
            <article className="lumi-start__card">
              <small>Доступ к сезону</small>
              <strong>{season1Owned ? 'Полный сезон открыт' : `${season1PriceStars} ⭐`}</strong>
              <span>{season1Owned ? 'Покупка подтверждена' : 'Эпизод 1 доступен бесплатно'}</span>
            </article>
          </div>

          <button className="lumi-start__panel-action" type="button" onClick={onStart}>
            {hasProgress ? 'Продолжить историю' : 'Начать историю'}
          </button>
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="lumi-start__panel" aria-label="Настройки">
          <p className="lumi-eyebrow">Настройки</p>
          <h1>Настройки LUMI</h1>
          <p className="lumi-start__panel-muted">Интерфейс и ощущения от истории</p>

          <div className="lumi-settings">
            <button type="button" className="lumi-settings__row" aria-pressed={motionEnabled} onClick={() => setMotionEnabled(value => !value)}>
              <span><strong>Анимации интерфейса</strong><small>Плавные переходы на главном экране</small></span>
              <b>{motionEnabled ? 'Вкл' : 'Выкл'}</b>
            </button>
            <button type="button" className="lumi-settings__row" aria-pressed={hapticsEnabled} onClick={() => setHapticsEnabled(value => !value)}>
              <span><strong>Тактильная отдача</strong><small>Отклик при действиях в Telegram</small></span>
              <b>{hapticsEnabled ? 'Вкл' : 'Выкл'}</b>
            </button>
          </div>

          <p className="lumi-settings__note">Настройки применяются в текущем сеансе LUMI.</p>
        </section>
      ) : null}

      <Navigation tab={tab} onTab={setTab} />
    </main>
  );
}
