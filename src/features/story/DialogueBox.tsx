import type { Scene } from '../../story/schema';

type DialogueBoxProps = {
  scene: Scene;
  canAdvance: boolean;
  onAdvance(): Promise<void> | void;
};

export function DialogueBox({ scene, canAdvance, onAdvance }: DialogueBoxProps) {
  return (
    <section
      className={`lumi-dialogue lumi-dialogue--${scene.kind}`}
      data-kind={scene.kind}
      aria-live="polite"
    >
      {scene.speaker ? <strong className="lumi-dialogue__speaker">{scene.speaker}</strong> : null}
      <div className="lumi-dialogue__copy">
        <p>{scene.text}</p>
      </div>
      {canAdvance ? (
        <button
          className="lumi-dialogue__advance"
          type="button"
          onClick={() => void onAdvance()}
          aria-label="Продолжить"
        >
          <span>Продолжить</span><span aria-hidden="true">›</span>
        </button>
      ) : null}
    </section>
  );
}
