import { useEffect, useState } from 'react';
import { createSeasonInvoice, getPaymentStatus } from '../../api/client';
import { trackEvent } from '../../analytics/events';
import { getStoryCatalogEntry } from '../../story/catalog';
import { getTelegramContext, openTelegramInvoice } from '../../telegram/telegram';

type Props = {
  storyId?: string;
  seasonId?: string;
  episodeId?: string;
  sceneId?: string;
  episodeNumber?: number;
  nextEpisodeTitle?: string;
  imageSrc?: string;
  priceStars?: number;
  onPurchased?(): Promise<void> | void;
  onMenu?(): void;
};

const CONFIRM_ATTEMPTS = 8;

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function waitForServerOwnership(initData: string, storyId: string, seasonId: string): Promise<boolean> {
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
    const status = await getPaymentStatus(initData, storyId, seasonId);
    if (status.season1Owned) return true;
    if (attempt < CONFIRM_ATTEMPTS - 1) await delay(350);
  }
  return false;
}

export function PrototypePaywall({
  storyId = 'last-online',
  seasonId = 'season-1',
  episodeId = 'last-online-s1-e1',
  sceneId = 'ep1_end_paywall',
  episodeNumber = 1,
  nextEpisodeTitle = 'Тот, кого все знают',
  imageSrc,
  priceStars = 149,
  onPurchased,
  onMenu,
}: Props = {}) {
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string>();
  const storyTitle = getStoryCatalogEntry(storyId).title;
  const offer = `season:${storyId}:${seasonId}`;

  useEffect(() => {
    void trackEvent('paywall_opened', { episodeId, sceneId, offer, priceStars });
  }, [episodeId, sceneId, offer, priceStars]);

  async function confirmOwnership(initData: string): Promise<boolean> {
    setChecking(true);
    try {
      const owned = await waitForServerOwnership(initData, storyId, seasonId);
      if (owned) {
        setNotice('Покупка подтверждена. Продолжение открыто.');
        await onPurchased?.();
        return true;
      }
      setNotice('Telegram принял оплату, но сервер ещё подтверждает её. Нажмите «Проверить оплату».');
      return false;
    } finally {
      setChecking(false);
    }
  }

  async function handlePurchase() {
    if (pending || checking) return;
    setPending(true);
    setNotice(undefined);
    void trackEvent('purchase_clicked', { episodeId, sceneId, offer, priceStars });
    try {
      const { initData } = getTelegramContext();
      const invoice = await createSeasonInvoice(initData, storyId, seasonId);
      if (invoice.season1Owned) {
        setNotice('Сезон уже куплен. Продолжение открыто.');
        await onPurchased?.();
        return;
      }
      if (!invoice.invoiceUrl) throw new Error('INVOICE_URL_MISSING');

      const invoiceStatus = await openTelegramInvoice(invoice.invoiceUrl);
      if (invoiceStatus === 'cancelled') {
        setNotice('Оплата отменена. Доступ не изменён.');
        return;
      }
      if (invoiceStatus === 'failed') {
        setNotice('Telegram не завершил оплату. Попробуйте ещё раз.');
        return;
      }
      await confirmOwnership(initData);
    } catch {
      setNotice('Не удалось открыть оплату Telegram Stars. Попробуйте ещё раз.');
    } finally {
      setPending(false);
    }
  }

  async function handleCheck() {
    if (pending || checking) return;
    try {
      const { initData } = getTelegramContext();
      setNotice(undefined);
      const owned = await confirmOwnership(initData);
      if (!owned) setNotice('Подтверждённой покупки пока нет.');
    } catch {
      setNotice('Не удалось проверить оплату. Попробуйте ещё раз.');
    }
  }

  return <section className="lumi-paywall" aria-label="Покупка продолжения">
    {imageSrc ? <img src={imageSrc} alt="Финал эпизода" /> : null}
    <div className="lumi-paywall__body">
      <p className="lumi-eyebrow">Эпизод {episodeNumber} завершён</p>
      <h2>Продолжить: {nextEpisodeTitle}</h2>
      <p>Эпизод 1 — бесплатно. Купи сезон «{storyTitle}», чтобы открыть все опубликованные эпизоды после первого и будущие эпизоды этого сезона.</p>
      <div className="lumi-paywall__offer"><strong>Полный сезон</strong><span>{priceStars} ⭐</span></div>
      <small>Оплата проходит внутри Telegram через Telegram Stars. Доступ выдаётся только после подтверждения платежа Telegram.</small>
      <button className="lumi-primary" type="button" disabled={pending || checking} onClick={() => void handlePurchase()}>
        {pending ? 'Открываем оплату…' : `Купить за ${priceStars} ⭐`}
      </button>
      {notice?.includes('подтверждает') || notice === 'Подтверждённой покупки пока нет.' ? (
        <button className="lumi-primary" type="button" disabled={pending || checking} onClick={() => void handleCheck()}>
          {checking ? 'Проверяем…' : 'Проверить оплату'}
        </button>
      ) : null}
      {onMenu ? <button className="lumi-primary" type="button" disabled={pending || checking} onClick={onMenu}>К сезону</button> : null}
      {notice ? <p className="lumi-paywall__notice" role="status">{notice}</p> : null}
    </div>
  </section>;
}
