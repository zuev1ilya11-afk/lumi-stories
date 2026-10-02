import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Episode, StoryState } from '../../story/schema';
import { StoryScreen } from './StoryScreen';

const state: StoryState = {
  junhoScore: 0,
  taeyunScore: 0,
  truthScore: 0,
  riskScore: 0,
  flags: {},
};

const episode: Episode = {
  id: 'episode-test',
  title: 'Тестовый эпизод',
  startSceneId: 'dialogue',
  scenes: [
    {
      id: 'dialogue',
      kind: 'dialogue',
      speaker: 'Кан Джунхо',
      text: 'Ты ведь что-то от меня скрываешь?',
      background: 'apartment_hall_night',
      character: 'junho-guarded',
      nextSceneId: 'choice',
    },
    {
      id: 'choice',
      kind: 'dialogue',
      speaker: 'Лера',
      text: 'Что ответить?',
      background: 'apartment_hall_night',
      choices: [
        { id: 'open', text: 'Рассказать правду', nextSceneId: 'dialogue' },
        {
          id: 'locked',
          text: 'Показать улику',
          nextSceneId: 'dialogue',
          conditions: [{ kind: 'flagEquals', flag: 'has_clue', value: true }],
        },
      ],
    },
  ],
};

describe('StoryScreen', () => {
  it('renders dialogue speaker, text and background asset', () => {
    render(
      <StoryScreen episode={episode} sceneId="dialogue" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />,
    );
    expect(screen.getByText('Кан Джунхо')).toBeInTheDocument();
    expect(screen.getByText('Ты ведь что-то от меня скрываешь?')).toBeInTheDocument();
    expect(screen.getByTestId('story-stage')).toHaveStyle({
      backgroundImage: 'url(/assets/last-online/backgrounds/apartment_hall_night.webp)',
    });
  });

  it('renders only available choices', () => {
    render(<StoryScreen episode={episode} sceneId="choice" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Рассказать правду' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Показать улику' })).not.toBeInTheDocument();
  });

  it('disables choice buttons while async choose is pending and ignores repeated click', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const onChoose = vi.fn(() => pending);
    render(<StoryScreen episode={episode} sceneId="choice" state={state} onChoose={onChoose} onAdvance={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Рассказать правду' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    release();
  });
});
