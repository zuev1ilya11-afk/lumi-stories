import { publicAsset } from '../../publicAsset';

type StartScreenProps = {
  onStart(): void;
};

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <main className="lumi-start" aria-label="LUMI">
      <div
        className="lumi-start__art"
        aria-hidden="true"
        style={{ backgroundImage: `url(${publicAsset('assets/last-online/cover.webp')})` }}
      />
      <div className="lumi-start__veil" aria-hidden="true" />
      <section className="lumi-start__content">
        <h1 className="lumi-logo">LUMI</h1>
        <p className="lumi-tagline">Твоя история, твой выбор.</p>
        <button className="lumi-primary" type="button" onClick={onStart}>Начать историю</button>
      </section>
    </main>
  );
}
