import { publicAsset } from '../../publicAsset';

type SeasonScreenProps = {
  hasProgress: boolean;
  onPlay(): void;
  onBack(): void;
};

const EPISODES = [
  ['01', 'Номер, который не должен отвечать', false],
  ['02', 'Тот, кого все знают', true],
  ['03', 'Все лгут', true],
  ['04', 'Ночь исчезновения', true],
  ['05', 'Последний онлайн', true],
] as const;

export function SeasonScreen({ hasProgress, onPlay, onBack }: SeasonScreenProps) {
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
        {EPISODES.map(([number, title, locked]) => (
          <article className={`lumi-episode${locked ? ' lumi-episode--locked' : ''}`} key={number}>
            <span className="lumi-episode__number">{number}</span>
            <div><strong>{title}</strong><small>{locked ? 'Полная версия' : 'Бесплатно'}</small></div>
            <span aria-label={locked ? 'Закрыто' : 'Доступно'}>{locked ? '⌁' : '→'}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
