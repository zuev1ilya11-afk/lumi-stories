import { publicAsset } from '../../publicAsset';
import { getStoryCatalogEntry } from '../../story/catalog';
import { getEpisodeNumber } from '../../story/episodes';
import { getStoryRuntime } from '../../story/stories';

type SeasonScreenProps = {
  storyId?: string;
  hasProgress: boolean;
  currentEpisodeId?: string;
  episodeCompleted?: boolean;
  season1Owned?: boolean;
  season1PriceStars?: number;
  onPlay(): void;
  onOpenRecap?(episodeId: string): void;
  onBack(): void;
};

export function SeasonScreen({ storyId = 'last-online', hasProgress, currentEpisodeId, episodeCompleted = false, season1Owned = false, season1PriceStars = 149, onPlay, onOpenRecap, onBack }: SeasonScreenProps) {
  const story = getStoryCatalogEntry(storyId);
  const runtime = getStoryRuntime(storyId);
  const activeEpisodeId = currentEpisodeId ?? runtime.firstEpisode.id;
  const currentEpisode = getEpisodeNumber(activeEpisodeId);

  function episodeStatus(number: number, episodeId?: string) {
    const published = Boolean(episodeId && runtime.episodes.some(episode => episode.id === episodeId));
    if (!published) return 'В разработке';
    if (number < currentEpisode || (number === currentEpisode && episodeCompleted)) return 'Завершён';
    if (number === currentEpisode) return hasProgress ? 'Текущий эпизод' : 'Бесплатно';
    if (number === currentEpisode + 1 && episodeCompleted) return season1PriceStars === 0 || season1Owned ? 'Доступно' : `${season1PriceStars} ⭐`;
    return `После Эпизода ${number - 1}`;
  }

  const cover = story.coverAsset
    ? `linear-gradient(180deg, transparent, rgba(8,6,13,.25)), url(${publicAsset(story.coverAsset)})`
    : 'radial-gradient(circle at 50% 18%, rgba(208,194,220,.28), transparent 20%), linear-gradient(160deg, #211322, #0b0910 72%)';

  return (
    <main className="lumi-season">
      <header className="lumi-topbar">
        <button className="lumi-icon-button" type="button" onClick={onBack} aria-label="Назад">‹</button>
        <strong>LUMI</strong>
        <span className="lumi-topbar__spacer" />
      </header>
      <section className="lumi-season__hero">
        <div
          className="lumi-season__cover"
          aria-hidden="true"
          style={{ backgroundImage: cover }}
        />
        <div>
          <p className="lumi-eyebrow">История {story.order} · {story.seasonLabel}</p>
          <h1>{story.title}</h1>
          <p>{story.description}</p>
          {season1PriceStars === 0 ? <p>{storyId === 'last-online' ? 'Первый сезон — бесплатно. Эпизоды 1–5 открываются по мере выхода.' : 'Первый сезон — бесплатно. Новые эпизоды открываются по мере выхода.'}</p> : null}
          <button className="lumi-primary" type="button" onClick={onPlay}>
            {hasProgress ? 'Продолжить' : 'Начать'}
          </button>
        </div>
      </section>
      <section className="lumi-episodes" aria-label="Эпизоды сезона">
        {story.episodes.map(({ number, id: episodeId, title }) => {
          const episodeNumber = Number(number);
          const status = episodeStatus(episodeNumber, episodeId);
          const locked = status === 'В разработке' || status.startsWith('После Эпизода ') || status.endsWith('⭐');
          const completed = Boolean(episodeId) && (episodeNumber < currentEpisode || (episodeNumber === currentEpisode && episodeCompleted));
          const selectable = Boolean(episodeId && onOpenRecap && completed && !locked);
          const activate = () => {
            if (selectable && episodeId) onOpenRecap?.(episodeId);
          };
          return (
          <article
            className={`lumi-episode${locked ? ' lumi-episode--locked' : ''}`}
            key={number}
            data-episode-id={episodeId}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={selectable ? `Эпизод ${episodeNumber}: ${title}. Краткая сводка` : undefined}
            onClick={activate}
            onKeyDown={event => {
              if (!selectable || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              activate();
            }}
          >
            <span className="lumi-episode__number">{number}</span>
            <div><strong>{title}</strong><small>{completed && onOpenRecap ? `${status} · Краткая сводка` : status}</small></div>
            <span aria-label={locked ? 'Закрыто' : completed && onOpenRecap ? 'Краткая сводка' : 'Доступно'}>{locked ? '⌁' : '→'}</span>
          </article>
          );
        })}
      </section>
    </main>
  );
}
