import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Choice, Scene } from '../../story/schema';
import { sceneAsset } from '../story/presentation';
import { useReducedMotion } from '../story/useReducedMotion';
import { AttachmentViewer } from './AttachmentViewer';

export type ChatTimelineEvent = { type: 'message'; message: ChatMessage } | { type: 'attachment'; src: string };
type Props = { scene: Scene; availableChoices: Choice[]; onChoose(choiceId: string): Promise<void> | void; onAdvance(): Promise<void> | void; disabled?: boolean; onMenu?(): void; history?: ChatTimelineEvent[]; onHistory?(events: ChatTimelineEvent[]): void };
function messageKey(m: ChatMessage) { return `${m.from}:${m.text}`; }
export function SoaChatScreen({ scene, availableChoices, onChoose, onAdvance, disabled = false, onMenu, history = [], onHistory }: Props) {
  const reduced = useReducedMotion();
  const [timeline] = useState<ChatTimelineEvent[]>(() => {
    const messages = scene.chat?.messages ?? scene.text.split(/\n\s*\n/u).filter(Boolean).map(text => ({ from: 'soa' as const, text: text.replace(/^SOA:\s*/u, '') }));
    const added: ChatTimelineEvent[] = messages.filter(m => !history.some(h => h.type === 'message' && messageKey(h.message) === messageKey(m))).map(message => ({ type: 'message', message }));
    const src = sceneAsset(scene.attachment, 'cg');
    if (src && !history.some(h => h.type === 'attachment' && h.src === src)) added.push({ type: 'attachment', src });
    return [...history, ...added];
  });
  const first = timeline[history.length];
  // The selected outgoing reply is visible immediately; only its read state waits.
  const [visible, setVisible] = useState(reduced ? timeline.length : history.length + (first?.type === 'message' && first.message.from === 'lera' ? 1 : 0));
  const [readUntil, setReadUntil] = useState(reduced ? timeline.length : history.length);
  const [tailDone, setTailDone] = useState(reduced || !scene.chat?.typing);
  const [viewer, setViewer] = useState<string>();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const thread = useRef<HTMLDivElement>(null);
  const allEvents = visible >= timeline.length;
  const complete = (allEvents && tailDone) || reduced;
  const next = timeline[visible];
  const typing = !reduced && ((!allEvents && next?.type === 'message' && next.message.from === 'soa') || (allEvents && !tailDone));
  useEffect(() => {
    if (reduced) { setVisible(timeline.length); setReadUntil(timeline.length); setTailDone(true); return; }
    if (allEvents) return;
    const timer = setTimeout(() => setVisible(n => n + 1), next?.type === 'attachment' ? 600 : 650);
    return () => clearTimeout(timer);
  }, [visible, allEvents, reduced, timeline.length, next?.type]);
  useEffect(() => {
    if (visible <= readUntil) return;
    const timer = setTimeout(() => setReadUntil(visible), 350);
    return () => clearTimeout(timer);
  }, [visible, readUntil]);
  useEffect(() => {
    if (!allEvents || tailDone) return;
    const timer = setTimeout(() => setTailDone(true), 800);
    return () => clearTimeout(timer);
  }, [allEvents, tailDone]);
  useEffect(() => { if (complete) onHistory?.(timeline); }, [complete, onHistory, timeline]);
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [visible, typing]);
  function reveal() { setVisible(timeline.length); setReadUntil(timeline.length); setTailDone(true); }
  async function act(action: () => Promise<void> | void, id?: string) {
    if (lock.current || disabled) return;
    lock.current = true; setPending(true); setSelected(id); setError(false);
    try { await action(); } catch { setError(true); }
    finally { lock.current = false; setPending(false); }
  }
  return <section className="lumi-soa" aria-label="Переписка с SOA" data-chat-complete={complete}>
    <header className="lumi-soa__header">
      <button className="lumi-soa__back" type="button" aria-label="Меню" onClick={onMenu}>‹</button>
      <div className="lumi-soa__avatar" aria-hidden="true">S</div>
      <div className="lumi-soa__identity"><strong>SOA</strong><small>{typing ? 'печатает…' : scene.chat?.status ?? 'была в сети очень давно'}</small></div><span className="lumi-soa__secure" aria-hidden="true">⋮</span>
    </header>
    <div className="lumi-soa__thread" ref={thread} role="log" aria-live="polite" aria-relevant="additions text">
      <div className="lumi-soa__date">Сегодня · 23:46</div>
      {timeline.slice(0, visible).map((event, i) => {
        if (event.type === 'attachment') return <div className="lumi-soa__message lumi-soa__message--soa" data-from="soa" key={`photo-${event.src}`}>
          <button className="lumi-soa__photo-button" type="button" aria-label="Открыть IMG_0317_old.jpg" onClick={() => setViewer(event.src)}><img className="lumi-soa__attachment" src={event.src} alt="Вложение от SOA" /><span>IMG_0317_old.jpg <small>Открыть фотографию ↗</small></span></button>
        </div>;
        const message = event.message;
        return message.from === 'system'
          ? <p className="lumi-soa__system" data-from="system" key={`${i}-${message.text}`}>{message.text}</p>
          : <div className={`lumi-soa__message lumi-soa__message--${message.from}`} data-from={message.from} key={`${i}-${message.text}`}>
            <p className="lumi-soa__bubble">{message.text}</p>
            {message.from === 'lera' ? <small className="lumi-soa__meta">{readUntil > i ? `✓✓ ${message.meta ?? 'прочитано'}` : '✓ отправлено'}</small> : null}
          </div>;
      })}
      {typing ? <div className="lumi-soa__typing" aria-label="SOA печатает"><span /><span /><span /></div> : null}
      {complete && scene.chat?.context ? <p className="lumi-soa__context">{scene.chat.context}</p> : null}
    </div>
    <div className="lumi-soa__replies" aria-label="Ответы SOA">
      {!complete ? <button className="lumi-soa__skip" type="button" onClick={reveal}>Показать сообщения<span aria-hidden="true">›</span></button> : <>
        {availableChoices.map(choice => <button type="button" disabled={disabled || pending} data-selected={selected === choice.id} key={choice.id} onClick={event => { if (event.detail < 2) void act(() => onChoose(choice.id), choice.id); }}><span>{choice.text}</span><span aria-hidden="true">›</span></button>)}
        {availableChoices.length === 0 && (scene.nextSceneId || scene.transitions?.length) ? <button type="button" className="lumi-soa__advance" disabled={disabled || pending} onClick={event => { if (event.detail < 2) void act(onAdvance); }}>Продолжить<span aria-hidden="true">›</span></button> : null}
      </>}
      {error ? <p role="alert">Не удалось сохранить ответ. Попробуйте ещё раз.</p> : null}
    </div>
    {viewer ? <AttachmentViewer src={viewer} onClose={() => setViewer(undefined)} /> : null}
  </section>;
}
