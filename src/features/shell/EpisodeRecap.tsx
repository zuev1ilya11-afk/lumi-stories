import { useState } from 'react';
import { createEpisodeRewindInvoice, getEpisodeRewindStatus } from '../../api/client';
import { trackEvent } from '../../analytics/events';
import { getTelegramContext, openTelegramInvoice } from '../../telegram/telegram';
import { EPISODE_RECAPS } from './episodeRecaps';

type EpisodeRecapProps = {
  episodeId: string;
  rewindPriceStars?: number;
  onRewindComplete?(episodeId: string): Promise<void> | void;
  onBack(): void;
};



const CONFIRM_ATTEMPTS = 8;

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function waitForRewind(initData: string, episodeId: string): Promise<boolean> {
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
    const status = await getEpisodeRewindStatus(initData, episodeId);
    if (status.applied) return true;
    if (attempt < CONFIRM_ATTEMPTS - 1) await delay(350);
  }
  return false;
}

export function EpisodeRecap({
  episodeId,
  rewindPriceStars = 49,
  onRewindComplete,
  onBack,
}: EpisodeRecapProps) {
  const recap = EPISODE_RECAPS[episodeId as keyof typeof EPISODE_RECAPS];
  const freeRewind = rewindPriceStars === 0;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [notice, setNotice] = useState<string>();
  if (!recap) return null;

  async function finishRewind(initData: string): Promise<boolean> {
    setChecking(true);
    try {
      const applied = await waitForRewind(initData, episodeId);
      setNeedsCheck(false);
      if (!applied) {
        setNotice(freeRewind ? 'Перезапуск ещё применяется. Нажмите «Проверить».' : 'Оплата подтверждена, но перезапуск ещё применяется. Нажмите «Проверить».');
        return false;
      }
      setNotice('Эпизод перезапущен. Новые решения заменят прежнюю ветку сюжета.');
      void trackEvent('replay_started', { episodeId, offer: 'episode-rewind', priceStars: rewindPriceStars });
      await onRewindComplete?.(episodeId);
      return true;
    } finally {
      setChecking(false);
    }
  }

  async function handleRewindPurchase() {
    if (pending || checking) return;
    setPending(true);
    setNotice(undefined);
    setNeedsCheck(false);
    if (!freeRewind) void trackEvent('purchase_clicked', { episodeId, offer: 'episode-rewind', priceStars: rewindPriceStars });
    try {
      const { initData } = getTelegramContext();
      const invoice = await createEpisodeRewindInvoice(initData, episodeId);
      if (invoice.applied && invoice.priceStars === 0) {
        await finishRewind(initData);
        return;
      }
      if (!invoice.invoiceUrl) throw new Error('Missing rewind invoice');
      const status = await openTelegramInvoice(invoice.invoiceUrl);
      if (status === 'cancelled') {
        setNotice('Оплата отменена. Прогресс не изменён.');
        return;
      }
      if (status === 'failed') {
        setNotice('Telegram не завершил оплату. Прогресс не изменён.');
        return;
      }
      await finishRewind(initData);
    } catch {
      setNeedsCheck(true);
      setNotice('Не удалось подтвердить перезапуск. Нажмите «Проверить», чтобы загрузить актуальный прогресс.');
    } finally {
      setPending(false);
    }
  }

  async function handleCheck() {
    if (pending || checking) return;
    try {
      const { initData } = getTelegramContext();
      setNotice(undefined);
      const applied = await finishRewind(initData);
      if (!applied) setNotice('Перезапуск пока не подтверждён сервером.');
    } catch {
      setNeedsCheck(true);
      setNotice('Не удалось проверить перезапуск. Попробуйте ещё раз.');
    }
  }

  return (
    <main className="lumi-recap" aria-label={`Краткая сводка эпизода ${recap.number}`}>
      <header className="lumi-topbar">
        <button className="lumi-icon-button" type="button" disabled={pending || checking || needsCheck} onClick={onBack} aria-label="Назад">‹</button>
        <strong>LUMI</strong>
        <span className="lumi-topbar__spacer" />
      </header>
      <section className="lumi-recap__content">
        <p className="lumi-eyebrow">Ранее в LUMI · Эпизод {recap.number}</p>
        <h1>{recap.title}</h1>
        <p className="lumi-recap__lead">Коротко о главном перед продолжением истории.</p>
        <ol className="lumi-recap__events">
          {recap.points.map((point, index) => (
            <li key={point}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{point}</p>
            </li>
          ))}
        </ol>
        <p className="lumi-recap__note">Ранее сделанные выборы сохранены. Сводка ничего не меняет в истории.</p>

        {onRewindComplete ? (
          <section className="lumi-recap__rewind" aria-label="Изменить события эпизода">
            {!confirming ? (
              <>
                <strong>Хотите изменить прошлые решения?</strong>
                <p>{freeRewind ? 'Для твоего аккаунта повторное прохождение бесплатно.' : 'Можно начать этот эпизод заново за Stars и выбрать другие варианты.'}</p>
                <button className="lumi-primary" type="button" onClick={() => setConfirming(true)}>
                  {freeRewind ? 'Изменить события — бесплатно' : `Изменить события — ${rewindPriceStars} ⭐`}
                </button>
              </>
            ) : (
              <>
                <strong>Переписать события эпизода?</strong>
                <p>{freeRewind ? 'После подтверждения' : 'После оплаты'} этот эпизод начнётся заново. Прогресс всех следующих эпизодов будет сброшен, потому что новые решения могут изменить дальнейший сюжет.</p>
                <button className="lumi-primary" type="button" disabled={pending || checking || needsCheck} onClick={() => void handleRewindPurchase()}>
                  {pending ? (freeRewind ? 'Начинаем заново…' : 'Открываем оплату…') : (freeRewind ? 'Начать заново бесплатно' : `Подтвердить за ${rewindPriceStars} ⭐`)}
                </button>
                <button className="lumi-recap__secondary" type="button" disabled={pending || checking} onClick={() => setConfirming(false)}>
                  Отмена
                </button>
              </>
            )}
            {needsCheck || notice?.includes('применяется') || notice === 'Перезапуск пока не подтверждён сервером.' ? (
              <button className="lumi-recap__secondary" type="button" disabled={pending || checking} onClick={() => void handleCheck()}>
                {checking ? 'Проверяем…' : 'Проверить'}
              </button>
            ) : null}
            {notice ? <p className="lumi-recap__status" role="status">{notice}</p> : null}
          </section>
        ) : null}

        <button className="lumi-primary" type="button" disabled={pending || checking || needsCheck} onClick={onBack}>Назад к эпизодам</button>
      </section>
    </main>
  );
}
