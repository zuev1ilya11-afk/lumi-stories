type StartScreenProps = {
  onStart(): void;
};

const FEATURES = [
  ['♡', 'Любовные линии'],
  ['◈', 'Неожиданные повороты'],
  ['⌁', 'Твои решения имеют значение'],
  ['✦', 'Новые истории каждую неделю'],
] as const;

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <main className="lumi-start lumi-start--minimal" aria-label="LUMI">
      <div className="lumi-start__stars" aria-hidden="true" />
      <div className="lumi-start__moon" aria-hidden="true" />
      <div className="lumi-start__horizon" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

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

        <button
          className="lumi-start__cta"
          type="button"
          aria-label="Начать историю"
          onClick={onStart}
        >
          <span aria-hidden="true">▷</span>
          Начать
        </button>
      </section>

      <nav className="lumi-start__nav" aria-label="Навигация LUMI">
        <button type="button" className="is-active" aria-current="page" onClick={onStart}>
          <span aria-hidden="true">▱</span>
          Истории
        </button>
        <span className="lumi-start__nav-mark" aria-hidden="true">✦</span>
      </nav>
    </main>
  );
}
