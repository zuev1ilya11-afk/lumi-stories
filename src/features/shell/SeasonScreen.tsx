import { publicAsset } from '../../publicAsset';
import { episodes, getEpisodeNumber } from '../../story/episodes';

type SeasonScreenProps = {
  hasProgress: boolean;
  currentEpisodeId?: string;
  episodeCompleted?: boolean;
  season1Owned?: boolean;
  season1PriceStars?: number;
  onPlay(): void;
  onOpenRecap?(episodeId: string): void;
  onBack(): void;
};

const EPISODES = [
  ['01', 'last-online-s1-e1', 'Номер, который не должен отвечать'],
  ['02', 'last-online-s1-e2', 'Тот, кого все знают'],
  ['03', 'last-online-s1-e3', 'Все лгут'],
  ['04', 'last-online-s1-e4', 'Ночь исчезновения'],
  ['05', undefined, 'Последний онлайн'],
] as const;

export function SeasonScreen({ hasProgress, currentEpisodeId = 'last-online-s1-e1', episodeCompleted = false, season1Owned = false, season1PriceStars = 149, onPlay, onOpenRecap, onBack }: SeasonScreenProps) {
  const currentEpisode = getEpisodeNumber(currentEpisodeId);
  function episodeStatus(number: number) {
    if (number > episodes.length) return 'В разработке';
    if (number < currentEpisode || (number === currentEpisode && episodeCompleted)) return 'Завершён';
    if (number === currentEpisode) return hasProgress ? 'Текущий эпизод' : 'Бесплатно';
    if (number === currentEpisode + 1 && episodeCompleted) return season1Owned ? 'Доступно' : `${season1PriceStars} ⭐`;
    return `После Эпизода ${number - 1}`;
  }
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
          style={{
            backgroundImage: `linear-gradient(180deg, transparent, rgba(8,6,13,.25)), url(${publicAsset('assets/last-online/cover.webp')})`,
          }}
        />
        <div>
          <p className="lumi-eyebrow">История 1 · Сезон 1</p>
          <h1>Последний онлайн</h1>
          <p>Новый город. Загадочный сосед. И сообщения с аккаунта девушки, исчезнувшей три года назад.</p>
          {season1PriceStars === 0 ? <p>Первый сезон — бесплатно. Эпизоды 1–5 открываются по мере выхода.</p> : null}
          <button className="lumi-primary" type="button" onClick={onPlay}>
            {hasProgress ? 'Продолжить' : 'Начать'}
          </button>
        </div>
      </section>
      <section className="lumi-episodes" aria-label="Эпизоды сезона">
        {EPISODES.map(([number, episodeId, title]) => {
          const episodeNumber = Number(number);
          const status = episodeStatus(episodeNumber);
          const locked = status === 'В разработке' || status.startsWith('После Эпизода ') || status.endsWith('⭐');
          const completed = episodeNumber < currentEpisode || (episodeNumber === currentEpisode && episodeCompleted);
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
            <div><strong>{title}</strong><small>{completed ? `${status} · Краткая сводка` : status}</small></div>
            <span aria-label={locked ? 'Закрыто' : completed ? 'Краткая сводка' : 'Доступно'}>{locked ? '⌁' : '→'}</span>
          </article>
          );
        })}
      </section>
    </main>
  );
}
