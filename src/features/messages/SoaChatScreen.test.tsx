import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Choice, Scene } from '../../story/schema';
import { SoaChatScreen } from './SoaChatScreen';

const choices: Choice[] = [
  { id: 'tell', text: 'Рассказать Джунхо', nextSceneId: 'next' },
  { id: 'hide', text: 'Скрыть сообщение', nextSceneId: 'next' },
];

const scene: Scene = {
  id: 'soa-fixture',
  kind: 'message',
  speaker: 'SOA',
  text: 'Ты живёшь напротив него?\n\nНе говори Джунхо, что я тебе написала.',
  background: 'lera_room_night',
  choices,
};

describe('SoaChatScreen', () => {
  it('renders SOA identity, stale status and message bubbles', () => {
    render(<SoaChatScreen scene={scene} availableChoices={choices} onChoose={vi.fn()} onAdvance={vi.fn()} />);
    expect(screen.getByText('SOA')).toBeInTheDocument();
    expect(screen.getByText('была в сети очень давно')).toBeInTheDocument();
    expect(screen.getByText('Ты живёшь напротив него?')).toBeInTheDocument();
    expect(screen.getByText('Не говори Джунхо, что я тебе написала.')).toBeInTheDocument();
  });

  it('uses the story engine callback for replies', () => {
    const onChoose = vi.fn();
    render(<SoaChatScreen scene={scene} availableChoices={choices} onChoose={onChoose} onAdvance={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть сообщение' }));
    expect(onChoose).toHaveBeenCalledWith('hide');
  });

  it('renders attachment when the scene declares one', () => {
    render(
      <SoaChatScreen scene={{ ...scene, attachment: 'soa-junho-old-photo' }} availableChoices={[]} onChoose={vi.fn()} onAdvance={vi.fn()} />,
    );
    expect(screen.getByRole('img', { name: 'Вложение от SOA' })).toHaveAttribute(
      'src', '/assets/last-online/cg/soa-junho-old-photo.webp',
    );
  });

  it('advances a message scene with nextSceneId when there are no reply choices', () => {
    const onAdvance = vi.fn();
    render(
      <SoaChatScreen
        scene={{ ...scene, choices: undefined, nextSceneId: 'next-message' }}
        availableChoices={[]}
        onChoose={vi.fn()}
        onAdvance={onAdvance}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});


it('renders structured incoming, outgoing and system chat messages', () => {
  const structured = {
    ...scene,
    chat: {
      status: 'была в сети очень давно',
      typing: true,
      messages: [
        { from: 'soa', text: 'Ты живёшь напротив него?' },
        { from: 'lera', text: 'Кто ты?', meta: 'прочитано' },
        { from: 'system', text: 'SOA печатает…' },
      ],
    },
  } as unknown as Scene;

  render(
    <SoaChatScreen
      scene={structured}
      availableChoices={[]}
      onChoose={vi.fn()}
      onAdvance={vi.fn()}
    />,
  );

  expect(screen.getByText('Кто ты?').closest('[data-from]')).toHaveAttribute('data-from', 'lera');
  expect(screen.getByText('Ты живёшь напротив него?').closest('[data-from]')).toHaveAttribute('data-from', 'soa');
  expect(screen.getByText('прочитано')).toBeInTheDocument();
  expect(screen.getByText('SOA печатает…')).toBeInTheDocument();
  expect(screen.getByLabelText('SOA печатает')).toBeInTheDocument();
});
