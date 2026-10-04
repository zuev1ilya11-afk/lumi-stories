import type { Beat } from '../../story/schema';
type Props = {
  beat: Beat; visibleText: string; complete: boolean; index: number; total: number;
  canTap: boolean; disabled: boolean; onTap(): void;
};
export function DialogueBox({ beat, visibleText, complete, index, total, canTap, disabled, onTap }: Props) {
  return <section className={`lumi-dialogue lumi-dialogue--${beat.speaker ? 'dialogue' : 'narrative'}`} data-kind={beat.speaker ? 'dialogue' : 'narrative'} data-complete={complete}>
    {beat.speaker ? <strong className="lumi-dialogue__speaker">{beat.speaker}</strong> : null}
    <div className="lumi-dialogue__copy" onClick={event => { if (event.detail < 2 && canTap && !disabled) onTap(); }}>
      <p aria-live={complete ? "polite" : "off"} aria-atomic="true">{visibleText || '\u00a0'}{!complete ? <span className="lumi-text-cursor" aria-hidden="true" /> : null}</p>
    </div>
    <div className="lumi-dialogue__footer">
      <span className="lumi-beat-progress" aria-label={`Фрагмент ${index + 1} из ${total}`}><i style={{ width: `${((index + 1) / total) * 100}%` }} /></span>
      {canTap ? <button className="lumi-dialogue__advance" type="button" aria-label="Продолжить" disabled={disabled}
        onClick={event => { if (event.detail < 2) onTap(); }}><span>{disabled ? 'Сохраняем…' : complete ? 'Далее' : 'Показать текст'}</span><span aria-hidden="true">›</span></button> : <small>Твой выбор</small>}
    </div>
  </section>;
}
