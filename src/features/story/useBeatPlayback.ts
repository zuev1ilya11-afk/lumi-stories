import { useEffect, useState } from 'react';
import type { Beat } from '../../story/schema';
export function useBeatPlayback(beats: Beat[], reduced: boolean) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const beat = beats[index];
  const complete = reduced || revealed >= beat.text.length;
  useEffect(() => {
    if (complete) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => {
      interval = setInterval(() => setRevealed(n => Math.min(n + 2, beat.text.length)), 32);
    }, beat.delay ?? 0);
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [index, beat.text, beat.delay, complete]);
  function tap() {
    if (!complete) { setRevealed(beat.text.length); return false; }
    if (index < beats.length - 1) { setIndex(index + 1); setRevealed(0); return false; }
    return true;
  }
  return { beat, index, complete, final: index === beats.length - 1, visibleText: complete ? beat.text : beat.text.slice(0, revealed), tap };
}
