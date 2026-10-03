type EpisodeRecapProps = {
  episodeId: string;
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

export function EpisodeRecap({ episodeId, onBack }: EpisodeRecapProps) {
  const recap = RECAPS[episodeId as keyof typeof RECAPS];
  if (!recap) return null;

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
        <p className="lumi-recap__note">Ранее сделанные выборы сохранены. Этот экран только напоминает события и ничего не меняет в истории.</p>
        <button className="lumi-primary" type="button" onClick={onBack}>Назад к эпизодам</button>
      </section>
    </main>
  );
}
