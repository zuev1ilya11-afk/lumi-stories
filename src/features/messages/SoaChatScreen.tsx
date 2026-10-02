import type { Choice, Scene } from '../../story/schema';

type SoaChatScreenProps = {
  scene: Scene;
  availableChoices: Choice[];
  onChoose(choiceId: string): Promise<void> | void;
  onAdvance(): Promise<void> | void;
  disabled?: boolean;
};

function normalizeBubble(text: string): string {
  return text.replace(/^SOA:\s*/u, '').trim();
}

export function SoaChatScreen({ scene, availableChoices, onChoose, onAdvance, disabled = false }: SoaChatScreenProps) {
  const bubbles = scene.text
    .split(/\n\s*\n/u)
    .map(normalizeBubble)
    .filter(Boolean);

  return (
    <section className="lumi-soa" aria-label="Переписка с SOA">
      <header className="lumi-soa__header">
        <div className="lumi-soa__avatar" aria-hidden="true">S</div>
        <div><strong>SOA</strong><small>была в сети очень давно</small></div>
      </header>
      <div className="lumi-soa__thread">
        {bubbles.map((bubble, index) => <p className="lumi-soa__bubble" key={`${scene.id}-${index}`}>{bubble}</p>)}
        {scene.attachment ? (
          <img
            className="lumi-soa__attachment"
            src={`/assets/last-online/cg/${scene.attachment}.webp`}
            alt="Вложение от SOA"
          />
        ) : null}
      </div>
      {availableChoices.length > 0 || scene.nextSceneId ? (
        <div className="lumi-soa__replies" aria-label="Ответы SOA">
          {availableChoices.map((choice) => (
            <button type="button" disabled={disabled} key={choice.id} onClick={() => void onChoose(choice.id)}>
              {choice.text}<span aria-hidden="true">›</span>
            </button>
          ))}
          {availableChoices.length === 0 && scene.nextSceneId ? (
            <button className="lumi-soa__advance" type="button" disabled={disabled} onClick={() => void onAdvance()}>
              Продолжить<span aria-hidden="true">›</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
