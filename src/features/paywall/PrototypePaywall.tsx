import { useEffect, useState } from 'react';
import { trackEvent } from '../../analytics/events';
import { publicAsset } from '../../publicAsset';

type Props = { episodeId?: string; sceneId?: string; episodeNumber?: number; nextEpisodeTitle?: string; onContinue?(): Promise<void> | void; };
export function PrototypePaywall({ episodeId='last-online-s1-e1', sceneId='ep1_end_paywall', episodeNumber=1, nextEpisodeTitle, onContinue }: Props = {}) {
  const [clicked,setClicked]=useState(false); const [pending,setPending]=useState(false);
  useEffect(() => { void trackEvent('episode_finished',{episodeId,sceneId}); if (!onContinue) void trackEvent('paywall_opened',{episodeId,sceneId}); }, [episodeId,sceneId,onContinue]);
  async function handleContinue() {
    if (onContinue) { if (pending) return; setPending(true); try { await onContinue(); } finally { setPending(false); } return; }
    void trackEvent('purchase_clicked',{episodeId,offer:'season-1'}); setClicked(true);
  }
  if (onContinue && nextEpisodeTitle) return <section className="lumi-paywall" aria-label="Продолжение сезона">
    <img src={publicAsset('assets/last-online/v2/cg/cliffhanger.webp')} alt="Лера с телефоном прислушивается к закрытой двери" />
    <div className="lumi-paywall__body"><p className="lumi-eyebrow">Эпизод {episodeNumber} завершён</p><h2>Дальше: {nextEpisodeTitle}</h2><p>Все отношения, улики и решения сохранятся и повлияют на продолжение.</p><button className="lumi-primary" type="button" disabled={pending} onClick={() => void handleContinue()}>{pending?'Сохраняем…':'Продолжить'}</button></div>
  </section>;
  return <section className="lumi-paywall" aria-label="Продолжение сезона">
    <img src={publicAsset('assets/last-online/v2/cg/ep2-cliffhanger.svg')} alt="Джунхо встречает Леру и Тэюна у служебного лифта" />
    <div className="lumi-paywall__body"><p className="lumi-eyebrow">Эпизод {episodeNumber} завершён</p><h2>История только начинается</h2><p>Следующие эпизоды продолжат расследование комнаты B-17 и ночи исчезновения Соа.</p><div className="lumi-paywall__offer"><strong>Полный сезон</strong><span>249 ₽</span></div><small>249 ₽ — ориентир будущей цены. В Prototype оплата отключена.</small><button className="lumi-primary" type="button" onClick={() => void handleContinue()}>Продолжить</button>{clicked?<p className="lumi-paywall__notice" role="status">Покупка появится в полной версии</p>:null}</div>
  </section>;
}
