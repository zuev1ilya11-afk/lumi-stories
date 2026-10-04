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
  'house-of-black-roses-s1-e1': {
    number: 1,
    title: 'Наследница',
    points: [
      'Эвелин приехала в Рейвенхолл из-за наследства: чтобы получить поместье, она должна прожить в доме тридцать дней.',
      'Адриан Вейл встретил её как хранитель дома и дал три правила, которые звучали не как суеверия, а как предупреждения об опасности.',
      'После полуночи Эвелин услышала голос, называющий её по имени, а чёрные лепестки повели её по коридорам независимо от того, открыла она дверь или нет.',
      'В закрытой галерее она нашла портрет женщины 1901 года с собственным лицом. Женщину тоже звали Эвелин Рейвен.',
      'Адриан появился у портрета и сказал: «Я надеялся, что у нас будет больше времени», дав понять, что знает о тайне Рейвенхолла намного больше.',
    ],
  },
  'house-of-black-roses-s1-e2': {
    number: 2,
    title: 'Западное крыло',
    points: [
      'Адриан подтвердил имя первой Эвелин, но отказался объяснить своё обещание ей и снова попросил нынешнюю Эвелин не входить в западное крыло.',
      'Архивистка Изабель Моро показала фотографии 1931, 1957, 1986 и 2019 годов: на каждой был Адриан — с тем же лицом и почти без изменений.',
      'Ключ из конверта «Западное крыло. 1901» открыл комнату первой Эвелин. Там сохранились письма Адриана со знакомыми правилами и дневник с вырванной последней страницей.',
      'След привёл Эвелин в старую часовню к Люциану Кроу. Он подтвердил подлинность архивных снимков и рассказал, что в описи упоминается отдельный лист из дневника.',
      'После возвращения Адриан признал, что уже однажды решал за первую Эвелин, какую правду она способна выдержать. Ночью её отражение появилось в зеркале и оставило предупреждение: «НЕ ВЕРЬ ЕМУ.»',
    ],
  },
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
  'last-online-s1-e3': {
    number: 3,
    title: 'Все лгут',
    points: [
      'Лера остановила спор у лифта. Хан забрала пропуск B-17; спуск в закрытую комнату отложили.',
      'После эфира Лера попала на фотографии фанатов Тэюна, и в сети появились догадки об их отношениях.',
      'Восстановленный участок записи показал Тэюна у закрытой двери B17 в 02:19 — за семь минут до уже известного кадра из коридора. Полной картины той ночи по-прежнему нет.',
      'Лера сама решила, кому первой показать запись, и с кем провести вечер. Джунхо и Тэюн обещали рассказать свою часть событий.',
      'SOA потребовала объяснить, кому Лера верит, а затем прислала сообщение: «Ты уже выбрала не того.»',
    ],
  },
  'last-online-s1-e4': {
    number: 4,
    title: 'Ночь исчезновения',
    points: [
      'Джунхо признал свой поступок на старом фото и рассказал, как в ночь исчезновения пытался помочь Соа вынести документы из VANTA. По его словам, человек в куртке на записи — он.',
      'Тэюн признался: в 02:19 он слышал угрозы за дверью B17, но побоялся вмешаться. Позже он подписал ложное объяснение и теперь намерен официально его исправить.',
      'Разрешённые архивные выписки показали, что внутри VANTA скрывали нарушения, меняли сводки и исключили жалобы Соа из подготовленного пакета документов.',
      'Лера выбрала, кому доверить следующий шаг: Джунхо, Тэюну или никому из них. Все прежние решения остаются в силе.',
      'В реестре нашлась отметка о втором комплекте документов. SOA предложила выяснить, кто его принял. Судьба Соа и личность автора сообщений пока не установлены.',
    ],
  },
  'last-online-s1-e5': {
    number: 5,
    title: 'Последний онлайн',
    points: [
      'Реестр показал: второй комплект документов в 02:41 приняла координатор Хан. Она призналась, что видела Соа живой после служебного выхода.',
      'Закрытая опись и подтверждение независимого юриста доказали, что Соа пережила ту ночь и позже сознательно скрыла своё местонахождение.',
      'Хан призналась, что почти все сообщения от SOA отправляла она через старый телефон Соа, пытаясь заставить участников старой истории перестать молчать.',
      'Документы, исправленные показания и заявление Соа были переданы независимым адресатам; история VANTA стала публичной без раскрытия новой жизни Соа.',
      'После того как старый телефон Хан запечатали у юриста, аккаунт SOA прислал Лере одно последнее сообщение — «Спасибо.» — и сразу стал недоступен.',
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
