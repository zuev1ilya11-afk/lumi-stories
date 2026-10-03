import type { Choice } from '../../story/schema';

type ChoiceListProps = {
  choices: Choice[];
  disabled: boolean;
  selected?: string;
  onChoose(choiceId: string): Promise<void> | void;
};

export function ChoiceList({ choices, disabled, selected, onChoose }: ChoiceListProps) {
  if (choices.length === 0) return null;
  return (
    <div className="lumi-choices" aria-label="Выбор">
      {choices.map((choice) => (
        <button
          className="lumi-choice"
          type="button"
          key={choice.id}
          disabled={disabled}
          data-selected={selected === choice.id}
          onClick={() => void onChoose(choice.id)}
        >
          <span>{choice.text}</span><span aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}
