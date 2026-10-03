import { useState } from 'react';
import { useInterfacePreference } from '../../interfacePreferences';
import { publicAsset } from '../../publicAsset';
import { STORY_CATALOG, getStoryCatalogEntry } from '../../story/catalog';
import { getEpisodeNumber } from '../../story/episodes';

type StartScreenProps = {
  onStart(): void;
  onOpenStory?(storyId: string): void;
  userDisplayName?: string;
  hasProgress?: boolean;
  currentStoryId?: string;
  currentEpisodeId?: string;
  season1Owned?: boolean;
  season1PriceStars?: number;
};

type StartTab = 'home' | 'stories' | 'profile' | 'settings';

const FEATURES = [
  ['book', 'Увлекательные истории', 'Погружайся в новые миры'],
  ['heart', 'Герои, которые трогают', 'Настоящие эмоции и выборы'],
  ['spark', 'Твой путь, твои решения', 'Истории, в которых ты важна'],
  ['people', 'Сообщество единомышленников', 'Делись, обсуждай, вдохновляйся'],
] as const;

function Icon({ name }: { name: 'book' | 'heart' | 'spark' | 'people' | 'profile' | 'settings' }) {
  const paths = {
    book: 'M12 5C8 2 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-2-10 1Zm0 0v15',
    heart: 'M20.5 5.5c-2-2-5.5-2-8.5 1-3-3-6.5-3-8.5-1s-2 5.5 0 8L12 21l8.5-7.5c2-2.5 2-6 0-8Z',
    spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
    people: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-3a7 7 0 0 1 14 0v3M20 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 2 4M4 5a3 3 0 0 0 0 6m-1 3a5 5 0 0 0-2 4',
    profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-2a8 8 0 0 1 16 0v2',
    settings: 'm9 3 1-2h4l1 2 3 2 2 1 2 3-1 3v3l-2 3-3 1-2 2h-4l-2-2-3-1-2-3v-3L1 9l2-3 2-1 4-2ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function episodeLabel(id?: string): string {
  return `Эпизод ${getEpisodeNumber(id)}`;
}

function Navigation({ tab, onTab }: { tab: StartTab; onTab(tab: StartTab): void }) {
  return (
    <nav className="lumi-start__nav" aria-label="Навигация LUMI">
      <button type="button" className={tab === 'stories' ? 'is-active' : ''} aria-current={tab === 'stories' ? 'page' : undefined} onClick={() => onTab('stories')}>
        <Icon name="book" />
        Истории
      </button>
      <button type="button" className={tab === 'profile' ? 'is-active' : ''} aria-current={tab === 'profile' ? 'page' : undefined} onClick={() => onTab('profile')}>
        <Icon name="profile" />
        Профиль
      </button>
      <button type="button" className={tab === 'settings' ? 'is-active' : ''} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => onTab('settings')}>
        <Icon name="settings" />
        Настройки
      </button>
    </nav>
  );
}

function storyCover(story: (typeof STORY_CATALOG)[number]): string {
  if (story.coverAsset) {
    return `linear-gradient(180deg, transparent 30%, rgba(7,5,12,.82) 100%), url(${publicAsset(story.coverAsset)})`;
  }
  if (story.theme === 'gothic') {
    return 'radial-gradient(circle at 50% 18%, rgba(202,190,217,.28), transparent 19%), linear-gradient(160deg, #17111e 0%, #261428 42%, #09080d 100%)';
  }
  return 'linear-gradient(160deg, #21162c, #0a0910)';
}

export function StartScreen({
  onStart,
  onOpenStory,
  userDisplayName = 'Игрок LUMI',
  hasProgress = false,
  currentStoryId = 'last-online',
  currentEpisodeId = 'last-online-s1-e1',
  season1Owned = false,
  season1PriceStars = 149,
}: StartScreenProps) {
  const [tab, setTab] = useState<StartTab>('home');
  const [motionEnabled, toggleMotion] = useInterfacePreference('motion');
  const [hapticsEnabled, toggleHaptics] = useInterfacePreference('haptics');
  const currentStory = getStoryCatalogEntry(currentStoryId);

  function openStory(storyId: string) {
    if (!STORY_CATALOG.some(story => story.id === storyId && story.available)) return;
    if (onOpenStory) {
      onOpenStory(storyId);
      return;
    }
    if (storyId === currentStoryId) onStart();
  }

  return (
    <main className={`lumi-start${motionEnabled ? '' : ' is-calm'}`} data-tab={tab} aria-label="LUMI">
      <div
        className="lumi-start__hero-art"
        aria-hidden="true"
        style={{ backgroundImage: `url(${publicAsset('assets/ui/lumi-home-bg-v2.webp')})` }}
      />
      <div className="lumi-start__stars" aria-hidden="true" />
      <div className="lumi-start__shooting-stars" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="lumi-start__mist" aria-hidden="true">
        <span /><span />
      </div>

      {tab === 'home' ? (
        <section className="lumi-start__minimal-content">
          <div className="lumi-start__home-scroll" role="region" aria-label="Главный экран LUMI" tabIndex={0}>
            <div className="lumi-start__brand-block">
              <h1 className="lumi-logo lumi-logo--minimal">LUMI</h1>
              <p className="lumi-start__subtitle">Больше, чем истории</p>
            </div>

            <div className="lumi-start__features" aria-label="Возможности LUMI">
              {FEATURES.map(([icon, label, description]) => (
                <div className="lumi-start__feature" key={label}>
                  <span className="lumi-start__feature-icon"><Icon name={icon} /></span>
                  <p><strong>{label}</strong><small>{description}</small></p>
                </div>
              ))}
            </div>
          </div>

          <button className="lumi-start__cta" type="button" aria-label={hasProgress ? 'Продолжить историю' : 'Начать историю'} onClick={onStart}>
            <span aria-hidden="true">▷</span>
            {hasProgress ? 'Продолжить' : 'Начать'}
          </button>
        </section>
      ) : null}

      {tab !== 'home' ? (
        <header className="lumi-start__panel-header">
          <button type="button" aria-label="На главный экран" onClick={() => setTab('home')}>‹</button>
          <span>LUMI</span>
        </header>
      ) : null}

      {tab === 'stories' ? (
        <section className="lumi-start__panel lumi-stories-library" aria-label="Истории">
          <p className="lumi-eyebrow">Библиотека</p>
          <h1>Истории</h1>
          <p className="lumi-start__panel-muted">Все истории LUMI будут собраны здесь.</p>

          <div className="lumi-story-catalog">
            {STORY_CATALOG.map(story => {
              const isCurrentStory = story.id === currentStoryId;
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
                    style={{ backgroundImage: storyCover(story) }}
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
              <strong>{currentStory.title}</strong>
              <span>{episodeLabel(currentEpisodeId)} · {hasProgress ? 'в процессе' : 'не начато'}</span>
            </article>
            <article className="lumi-start__card">
              <small>Доступ к сезону</small>
              <strong>{season1PriceStars === 0 ? 'Бесплатный доступ' : season1Owned ? 'Полный сезон открыт' : `${season1PriceStars} ⭐`}</strong>
              <span>{season1PriceStars === 0 ? (currentStoryId === 'last-online' ? 'Эпизоды 1–5 бесплатно' : 'Эпизоды сезона доступны бесплатно') : season1Owned ? 'Покупка подтверждена' : 'Эпизод 1 доступен бесплатно'}</span>
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
            <button type="button" className="lumi-settings__row" aria-pressed={motionEnabled} onClick={toggleMotion}>
              <span><strong>Анимации интерфейса</strong><small>Плавные переходы на главном экране</small></span>
              <b>{motionEnabled ? 'Вкл' : 'Выкл'}</b>
            </button>
            <button type="button" className="lumi-settings__row" aria-pressed={hapticsEnabled} onClick={toggleHaptics}>
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
