import { useEffect, useState } from 'react';
import { trackEvent } from '../../analytics/events';
import { publicAsset } from '../../publicAsset';

export function PrototypePaywall() {
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    void trackEvent('episode_finished', { episodeId: 'last-online-s1-e1', sceneId: 'ep1_end_paywall' });
    void trackEvent('paywall_opened', { episodeId: 'last-online-s1-e1', sceneId: 'ep1_end_paywall' });
  }, []);

  function handleContinue() {
    void trackEvent('purchase_clicked', { episodeId: 'last-online-s1-e1', offer: 'season-1' });
    setClicked(true);
  }

  return (
    <section className="lumi-paywall" aria-label="Продолжение сезона">
      <img src={publicAsset('assets/last-online/cg/soa-junho-old-photo.webp')} alt="Старая фотография Соа и Джунхо" />
      <div className="lumi-paywall__body">
        <p className="lumi-eyebrow">Эпизод 1 завершён</p>
        <h2>История только начинается</h2>
        <p>Открой Эпизоды 2–5 и продолжи расследование исчезновения Соа.</p>
        <div className="lumi-paywall__offer">
          <strong>Полный сезон</strong>
          <span>249 ₽</span>
        </div>
        <small>249 ₽ — ориентир будущей цены. В Prototype оплата отключена.</small>
        <button className="lumi-primary" type="button" onClick={handleContinue}>Продолжить</button>
        {clicked ? <p className="lumi-paywall__notice" role="status">Покупка появится в полной версии</p> : null}
      </div>
    </section>
  );
}
