import type { ChatMessage, Choice, Scene } from '../../story/schema';
import { publicAsset } from '../../publicAsset';

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

function fallbackMessages(scene: Scene): ChatMessage[] {
  return scene.text
    .split(/\n\s*\n/u)
    .map(normalizeBubble)
    .filter(Boolean)
    .map((text) => ({ from: 'soa' as const, text }));
}

export function SoaChatScreen({
  scene,
  availableChoices,
  onChoose,
  onAdvance,
  disabled = false,
}: SoaChatScreenProps) {
  const messages = scene.chat?.messages ?? fallbackMessages(scene);
  const status = scene.chat?.status ?? 'была в сети очень давно';

  return (
    <section className="lumi-soa" aria-label="Переписка с SOA">
      <header className="lumi-soa__header">
        <div className="lumi-soa__avatar" aria-hidden="true">S</div>
        <div className="lumi-soa__identity">
          <strong>SOA</strong>
          <small>{status}</small>
        </div>
        <span className="lumi-soa__secure" aria-hidden="true">•••</span>
      </header>

      <div className="lumi-soa__thread" aria-live="polite">
        <div className="lumi-soa__date">Сегодня</div>
        {messages.map((message, index) => (
          message.from === 'system' ? (
            <p
              className="lumi-soa__system"
              data-from="system"
              key={`${scene.id}-${index}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              {message.text}
            </p>
          ) : (
            <div
              className={`lumi-soa__message lumi-soa__message--${message.from}`}
              data-from={message.from}
              key={`${scene.id}-${index}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <p className="lumi-soa__bubble">{message.text}</p>
              {message.meta ? <small className="lumi-soa__meta">{message.meta}</small> : null}
            </div>
          )
        ))}

        {scene.attachment ? (
          <div className="lumi-soa__message lumi-soa__message--soa" data-from="soa">
            <img
              className="lumi-soa__attachment"
              src={publicAsset(`assets/last-online/cg/${scene.attachment}.webp`)}
              alt="Вложение от SOA"
            />
          </div>
        ) : null}

        {scene.chat?.typing ? (
          <div className="lumi-soa__typing" aria-label="SOA печатает">
            <span /><span /><span />
          </div>
        ) : null}
      </div>

      {availableChoices.length > 0 || scene.nextSceneId ? (
        <div className="lumi-soa__replies" aria-label="Ответы SOA">
          {availableChoices.map((choice) => (
            <button
              type="button"
              disabled={disabled}
              key={choice.id}
              onClick={() => void onChoose(choice.id)}
            >
              <span>{choice.text}</span><span aria-hidden="true">›</span>
            </button>
          ))}
          {availableChoices.length === 0 && scene.nextSceneId ? (
            <button
              className="lumi-soa__advance"
              type="button"
              disabled={disabled}
              onClick={() => void onAdvance()}
            >
              Продолжить<span aria-hidden="true">›</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
