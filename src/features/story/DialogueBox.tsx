import type { Scene } from '../../story/schema';

type DialogueBoxProps = {
  scene: Scene;
  canAdvance: boolean;
  onAdvance(): Promise<void> | void;
};

export function DialogueBox({ scene, canAdvance, onAdvance }: DialogueBoxProps) {
  return (
    <section className="lumi-dialogue" aria-live="polite">
      {scene.speaker ? <strong className="lumi-dialogue__speaker">{scene.speaker}</strong> : null}
      <p>{scene.text}</p>
      {canAdvance ? (
        <button className="lumi-dialogue__advance" type="button" onClick={() => void onAdvance()} aria-label="Продолжить">
          Продолжить <span>›</span>
        </button>
      ) : null}
    </section>
  );
}
