import { publicAsset } from '../../publicAsset';
type SeasonScreenProps = { hasProgress: boolean; currentEpisodeNumber: number; onPlay(): void; onBack(): void; };
const EPISODES = [['01','Номер, который не должен отвечать'],['02','Тот, кого все знают'],['03','Все лгут'],['04','Ночь исчезновения'],['05','Последний онлайн']] as const;
export function SeasonScreen({ hasProgress, currentEpisodeNumber, onPlay, onBack }: SeasonScreenProps) {
  return <main className="lumi-season">
    <header className="lumi-topbar"><button className="lumi-icon-button" type="button" onClick={onBack} aria-label="Назад">‹</button><strong>LUMI</strong><span className="lumi-topbar__spacer" /></header>
    <section className="lumi-season__hero">
      <div className="lumi-season__cover" aria-hidden="true" style={{backgroundImage:`linear-gradient(180deg, transparent, rgba(8,6,13,.25)), url(${publicAsset('assets/last-online/cover.webp')})`}} />
      <div><p className="lumi-eyebrow">История 1 · Сезон 1</p><h1>Последний онлайн</h1><p>Новый город. Загадочный сосед. И сообщения с аккаунта девушки, исчезнувшей три года назад.</p><button className="lumi-primary" type="button" onClick={onPlay}>{hasProgress ? 'Продолжить' : 'Начать'}</button></div>
    </section>
    <section className="lumi-episodes" aria-label="Эпизоды сезона">{EPISODES.map(([number,title],index) => {
      const episodeNumber=index+1; const available=episodeNumber<=currentEpisodeNumber || episodeNumber===1;
      return <article className={`lumi-episode${available?'':' lumi-episode--locked'}`} key={number}><span className="lumi-episode__number">{number}</span><div><strong>{title}</strong><small>{episodeNumber===currentEpisodeNumber?'Текущий эпизод':available?'Пройдено / доступно':'В разработке'}</small></div><span aria-label={available?'Доступно':'Закрыто'}>{available?'→':'⌁'}</span></article>;
    })}</section>
  </main>;
}
