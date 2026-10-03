import { publicAsset } from '../../publicAsset';

type SeasonScreenProps = {
  hasProgress: boolean;
  currentEpisodeId?: string;
  episodeCompleted?: boolean;
  season1Owned?: boolean;
  season1PriceStars?: number;
  onPlay(): void;
  onBack(): void;
};

const EPISODES = [
  ['01', 'Номер, который не должен отвечать'],
  ['02', 'Тот, кого все знают'],
  ['03', 'Все лгут'],
  ['04', 'Ночь исчезновения'],
  ['05', 'Последний онлайн'],
] as const;

export function SeasonScreen({ hasProgress, currentEpisodeId = 'last-online-s1-e1', episodeCompleted = false, season1Owned = false, season1PriceStars = 149, onPlay, onBack }: SeasonScreenProps) {
  const currentEpisode = currentEpisodeId === 'last-online-s1-e2' ? 2 : 1;
  function episodeStatus(number: number) {
    if (number > 2) return 'В разработке';
    if (number < currentEpisode || (number === currentEpisode && episodeCompleted)) return 'Завершён';
    if (number === currentEpisode) return hasProgress ? 'Текущий эпизод' : 'Бесплатно';
    if (number === 2 && episodeCompleted && !season1Owned) return `${season1PriceStars} ⭐`;
    return episodeCompleted ? 'Доступно' : 'После Эпизода 1';
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
          <button className="lumi-primary" type="button" onClick={onPlay}>
            {hasProgress ? 'Продолжить' : 'Начать'}
          </button>
        </div>
      </section>
      <section className="lumi-episodes" aria-label="Эпизоды сезона">
        {EPISODES.map(([number, title]) => {
          const status = episodeStatus(Number(number));
          const locked = status === 'В разработке' || status === 'После Эпизода 1' || status.endsWith('⭐');
          return (
          <article className={`lumi-episode${locked ? ' lumi-episode--locked' : ''}`} key={number}>
            <span className="lumi-episode__number">{number}</span>
            <div><strong>{title}</strong><small>{status}</small></div>
            <span aria-label={locked ? 'Закрыто' : 'Доступно'}>{locked ? '⌁' : '→'}</span>
          </article>
          );
        })}
      </section>
    </main>
  );
}
