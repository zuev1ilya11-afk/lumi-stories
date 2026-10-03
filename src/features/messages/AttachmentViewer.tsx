import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export function AttachmentViewer({ src, onClose }: { src: string; onClose(): void }) {
  const close = useRef<HTMLButtonElement>(null);
  const startY = useRef<number | undefined>(undefined);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    return () => { document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  return createPortal(<div className="lumi-photo-viewer" role="dialog" aria-modal="true" aria-label="IMG_0317_old.jpg"
    onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onTouchStart={event => { startY.current = event.touches[0]?.clientY; }}
    onTouchEnd={event => { if (!zoom && startY.current !== undefined && event.changedTouches[0]?.clientY - startY.current > 90) onClose(); startY.current = undefined; }}>
    <header><div><strong>IMG_0317_old.jpg</strong><small>За четыре дня до исчезновения</small></div><button ref={close} type="button" aria-label="Закрыть фотографию" onClick={onClose}>×</button></header>
    <div className="lumi-photo-viewer__image" data-zoom={zoom} onDoubleClick={() => setZoom(v => !v)}><img src={src} alt="Соа со звездой на шее и Джунхо у окна квартиры. Он держит её за запястье." /></div>
    <footer><span>Три года назад</span><button type="button" aria-label={zoom ? 'Уменьшить фотографию' : 'Увеличить фотографию'} onClick={() => setZoom(v => !v)}>{zoom ? '−' : '+'}</button></footer>
  </div>, document.body);
}
