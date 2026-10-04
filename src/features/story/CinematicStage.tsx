import { useEffect, useState } from 'react';
import type { Beat, Scene, ScenePresentation } from '../../story/schema';
import { sceneAsset } from './presentation';

function CrossfadeImage({ src, previous, className }: { src: string; previous?: string; className: string }) {
  const [last, setLast] = useState(previous ?? src);
  const [loaded, setLoaded] = useState('');
  useEffect(() => {
    if (loaded !== src) return;
    const timer = setTimeout(() => { setLast(src); }, 400);
    return () => clearTimeout(timer);
  }, [src, loaded]);
  return <>
    {last !== src ? <img className={`${className} lumi-art-previous`} src={last} alt="" aria-hidden="true" /> : null}
    <img key={src} className={`${className} ${loaded === src ? 'is-loaded' : ''}`} src={src} alt="" aria-hidden="true" onLoad={() => setLoaded(src)} onError={() => setLoaded(src)} />
  </>;
}

export function CinematicStage({ scene, beat, presentation: p, previous, beatIndex = 0 }: { scene: Scene; beat: Beat; presentation: ScenePresentation; previous?: string; beatIndex?: number }) {
  const background = sceneAsset(p.cg ?? beat.background ?? scene.background);
  const mirror = scene.id === 'gothic_ep2_mirror' || scene.id === 'gothic_ep2_end';
  const warning = scene.id === 'gothic_ep2_end';
  const fog = mirror && (warning || beatIndex > 0);
  const characters = p.cg ? [] : p.characters ?? (scene.character ? [{ id: scene.character.split('-')[0], src: sceneAsset(scene.character, 'characters')!, emotion: 'neutral' }] : []);
  return <div className="lumi-stage-layers" data-cg={Boolean(p.cg)} aria-hidden="true">
    <div className="lumi-framing" data-camera={p.camera}><div className="lumi-camera" data-motion={p.motion} data-position={p.position ?? 'center'}>
      {background ? <CrossfadeImage src={background} previous={previous} className="lumi-story__backdrop" /> : null}
      <div className="lumi-ambient" data-ambient={p.ambient ?? 'none'} />
      {fog ? <div className="lumi-rose-mirror-fog" /> : null}
      {warning ? <div className="lumi-rose-mirror-warning" data-revealed={beatIndex > 0}>НЕ ВЕРЬ ЕМУ.</div> : null}
    </div></div>
    {characters.map(c => <div key={c.id} className="lumi-actor" data-testid="stage-character" data-position={c.position ?? 'center'} data-depth={c.depth ?? 'foreground'} data-framing={c.framing ?? 'full-body'} data-emotion={c.emotion} data-pose={c.pose}>
      <CrossfadeImage src={sceneAsset(c.src)!} className="lumi-story__character" />
    </div>)}
    <div className="lumi-story__shade" />
    <div key={`${scene.id}-${beat.text}`} className="lumi-cinematic-effect" data-effect={p.effect ?? 'none'} />
  </div>;
}
