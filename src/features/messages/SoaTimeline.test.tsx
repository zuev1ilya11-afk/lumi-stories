import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Scene } from '../../story/schema';
import { SoaChatScreen } from './SoaChatScreen';
const scene: Scene = { id: 'chat', kind: 'message', text: 'fallback', nextSceneId: 'next', attachment: 'soa-junho-old-photo', chat: { typing: true, messages: [
  { from: 'soa', text: 'Question' }, { from: 'lera', text: 'Answer', meta: 'прочитано' }, { from: 'system', text: 'Connection lost' },
] } };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function open(s = scene) { render(<SoaChatScreen scene={s} availableChoices={s.choices ?? []} onChoose={vi.fn()} onAdvance={vi.fn()} />); }
function time(ms: number) { act(() => vi.advanceTimersByTime(ms)); }

it('reveals incoming, outgoing and system messages in order with delayed read state', () => {
  open();
  expect(screen.queryByText('Question')).not.toBeInTheDocument();
  expect(screen.getByLabelText('SOA печатает')).toBeVisible();
  time(650);
  expect(screen.getByText('Question').closest('[data-from]')).toHaveAttribute('data-from', 'soa');
  expect(screen.queryByText('Answer')).not.toBeInTheDocument();
  time(650);
  expect(screen.getByText('Answer').closest('[data-from]')).toHaveAttribute('data-from', 'lera');
  expect(screen.queryByText(/✓✓ прочитано/)).not.toBeInTheDocument();
  time(350);
  expect(screen.getByText(/✓✓ прочитано/)).toBeVisible();
  time(300);
  expect(screen.getByText('Connection lost')).toHaveAttribute('data-from', 'system');
});

it('finishes simulated typing and offers continuation without a dead screen', () => {
  open({ ...scene, attachment: undefined });
  time(650); time(650); time(650);
  expect(screen.getByLabelText('SOA печатает')).toBeVisible();
  time(800);
  expect(screen.queryByLabelText('SOA печатает')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Продолжить' })).toBeVisible();
});

it('instant reveal cancels delays and exposes choices without sending a response', () => {
  open({ ...scene, choices: [{ id: 'reply', text: 'Reply', nextSceneId: 'next' }] });
  expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Показать сообщения' }));
  expect(screen.getByRole('button', { name: 'Reply' })).toBeVisible();
  expect(screen.queryByLabelText('SOA печатает')).not.toBeInTheDocument();
});

it('attachment appears after its message and opens fullscreen, Escape returns focus', () => {
  open();
  expect(screen.queryByRole('img', { name: 'Вложение от SOA' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Показать сообщения' }));
  const button = screen.getByRole('button', { name: 'Открыть IMG_0317_old.jpg' });
  button.focus(); fireEvent.click(button);
  expect(screen.getByRole('dialog', { name: 'IMG_0317_old.jpg' })).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

it('locks repeated reply click while the save is pending', () => {
  const choose = vi.fn(() => new Promise<void>(() => {}));
  render(<SoaChatScreen scene={scene} availableChoices={[{ id: 'reply', text: 'Reply', nextSceneId: 'next' }]} onChoose={choose} onAdvance={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Показать сообщения' }));
  const button = screen.getByRole('button', { name: 'Reply' });
  fireEvent.click(button); fireEvent.click(button);
  expect(choose).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
});

it('keeps received attachments in chronological history across photo-choice and reply scenes', () => {
  let history: import('./SoaChatScreen').ChatTimelineEvent[] = [];
  const onHistory = (events: import('./SoaChatScreen').ChatTimelineEvent[]) => { history = events; };
  const photo: Scene = { id: 'photo', kind: 'message', text: '', attachment: 'soa-junho-old-photo', nextSceneId: 'next', chat: { messages: [{ from: 'soa', text: 'Look at your apartment' }] } };
  const view = render(<SoaChatScreen key="photo" scene={photo} availableChoices={[]} onChoose={vi.fn()} onAdvance={vi.fn()} onHistory={onHistory} />);
  fireEvent.click(screen.getByRole('button', { name: 'Показать сообщения' }));
  view.rerender(<SoaChatScreen key="choice" scene={photo} availableChoices={[]} onChoose={vi.fn()} onAdvance={vi.fn()} history={history} onHistory={onHistory} />);
  expect(screen.getByRole('button', { name: 'Открыть IMG_0317_old.jpg' })).toBeVisible();
  expect(screen.getAllByText('Look at your apartment')).toHaveLength(1);
  const reply: Scene = { ...photo, id: 'reply', attachment: undefined, chat: { messages: [{ from: 'lera', text: 'Were you here?' }, { from: 'soa', text: 'Yes' }] } };
  view.rerender(<SoaChatScreen key="reply" scene={reply} availableChoices={[]} onChoose={vi.fn()} onAdvance={vi.fn()} history={history} />);
  expect(screen.getByRole('button', { name: 'Открыть IMG_0317_old.jpg' })).toBeVisible();
  expect(screen.getByText('Were you here?')).toBeVisible();
  expect(screen.queryByText('Yes')).not.toBeInTheDocument();
  expect(screen.getByLabelText('SOA печатает')).toBeVisible();
});
