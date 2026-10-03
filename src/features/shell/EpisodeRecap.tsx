import { useState } from 'react';
import { createEpisodeRewindInvoice, getEpisodeRewindStatus } from '../../api/client';
import { trackEvent } from '../../analytics/events';
import { getTelegramContext, openTelegramInvoice } from '../../telegram/telegram';

type EpisodeRecapProps = {
  episodeId: string;
  rewindPriceStars?: number;
  onRewindComplete?(episodeId: string): Promise<void> | void;
  onBack(): void;
};

const RECAPS = {
  'last-online-s1-e1': {
    number: 1,
    title: 'Номер, который не должен отвечать',
    points: [
      'Лера приехала в Хансу, поселилась в новой квартире и познакомилась с соседом Кан Джунхо.',
      'Она узнала, что Джунхо был участником ECLIPSE, а три года назад после исчезновения стажёрки Юн Соа оказался в центре громкого скандала.',
      'Аккаунт исчезнувшей Юн Соа неожиданно написал Лере и спросил, живёт ли она напротив Джунхо, попросив ничего ему не говорить.',
      'Джунхо предупредил Леру: три года назад похожие события тоже начинались с сообщений, а подвеска-звезда принадлежала Соа.',
      'В финале SOA прислала старую фотографию: Соа и Джунхо находятся в нынешней квартире Леры за четыре дня до исчезновения девушки.',
    ],
  },
  'last-online-s1-e2': {
    number: 2,
    title: 'Тот, кого все знают',
    points: [
      'Мина привела Леру волонтёром на студенческий эфир в VANTA, где она познакомилась с Ли Тэюном — действующим участником ECLIPSE.',
      'Тэюн мгновенно узнал телефонный номер Леры: раньше он принадлежал Соа.',
      'Расследование связало ночной звонок Тэюна Соа в 02:17 с архивной записью у B-17 в 02:26 — между событиями осталось девять необъяснённых минут.',
      'SOA снова вышла на связь и предупредила Леру не открывать дверь, если Тэюн рядом.',
      'Старый пропуск B-17 с кодом 0217 привёл Леру и Тэюна к служебному лифту, где их остановил Джунхо. Эпизод закончился прямым столкновением Джунхо и Тэюна.',
    ],
  },
} as const;

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
  const recap = RECAPS[episodeId as keyof typeof RECAPS];
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string>();
  if (!recap) return null;

  async function finishRewind(initData: string): Promise<boolean> {
    setChecking(true);
    try {
      const applied = await waitForRewind(initData, episodeId);
      if (!applied) {
        setNotice('Оплата подтверждена, но перезапуск ещё применяется. Нажмите «Проверить».');
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
    void trackEvent('purchase_clicked', { episodeId, offer: 'episode-rewind', priceStars: rewindPriceStars });
    try {
      const { initData } = getTelegramContext();
      const invoice = await createEpisodeRewindInvoice(initData, episodeId);
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
      setNotice('Не удалось запустить перезапуск эпизода. Попробуйте ещё раз.');
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
      setNotice('Не удалось проверить перезапуск. Попробуйте ещё раз.');
    }
  }

  return (
    <main className="lumi-recap" aria-label={`Краткая сводка эпизода ${recap.number}`}>
      <header className="lumi-topbar">
        <button className="lumi-icon-button" type="button" onClick={onBack} aria-label="Назад">‹</button>
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
                <p>Можно начать этот эпизод заново за Stars и выбрать другие варианты.</p>
                <button className="lumi-primary" type="button" onClick={() => setConfirming(true)}>
                  Изменить события — {rewindPriceStars} ⭐
                </button>
              </>
            ) : (
              <>
                <strong>Переписать события эпизода?</strong>
                <p>После оплаты этот эпизод начнётся заново. Прогресс всех следующих эпизодов будет сброшен, потому что новые решения могут изменить дальнейший сюжет.</p>
                <button className="lumi-primary" type="button" disabled={pending || checking} onClick={() => void handleRewindPurchase()}>
                  {pending ? 'Открываем оплату…' : `Подтвердить за ${rewindPriceStars} ⭐`}
                </button>
                <button className="lumi-recap__secondary" type="button" disabled={pending || checking} onClick={() => setConfirming(false)}>
                  Отмена
                </button>
              </>
            )}
            {notice?.includes('применяется') || notice === 'Перезапуск пока не подтверждён сервером.' ? (
              <button className="lumi-recap__secondary" type="button" disabled={pending || checking} onClick={() => void handleCheck()}>
                {checking ? 'Проверяем…' : 'Проверить'}
              </button>
            ) : null}
            {notice ? <p className="lumi-recap__status" role="status">{notice}</p> : null}
          </section>
        ) : null}

        <button className="lumi-primary" type="button" disabled={pending || checking} onClick={onBack}>Назад к эпизодам</button>
      </section>
    </main>
  );
}
