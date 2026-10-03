import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoryScreen } from './StoryScreen';
import { parseEpisode, type Episode } from '../../story/schema';

const state = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
const raw = {
  id: 'another-story', title: 'Another story', startSceneId: 'a', scenes: [{
    id: 'a', kind: 'narrative', text: 'First line. Second line.',
    presentation: { mode: 'cinematic', camera: 'wide', motion: 'slow-zoom', transition: 'crossfade', characters: [] },
    beats: [{ text: 'First line.' }, { text: 'Second line.', speaker: 'Mina',
      presentation: { camera: 'close', motion: 'push-in', characters: [{ id: 'mina', src: 'art/mina.webp', emotion: 'surprised', pose: 'recoil', position: 'left', framing: 'medium', depth: 'foreground' }] } }],
    nextSceneId: 'b',
  }, { id: 'b', kind: 'terminal', text: 'End' }],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function play(episode = raw as unknown as Episode, onAdvance = vi.fn()) {
  return { onAdvance, ...render(<StoryScreen episode={episode} sceneId="a" state={state} onChoose={vi.fn()} onAdvance={onAdvance} />) };
}
function tap() { fireEvent.click(screen.getByRole('button', { name: 'Продолжить' })); }

it('first tap completes typewriter, next tap advances only the local beat, final tap saves', () => {
  const { onAdvance } = play();
  expect(screen.queryByText('First line.')).not.toBeInTheDocument();
  tap();
  expect(screen.getByText('First line.')).toBeVisible();
  expect(onAdvance).not.toHaveBeenCalled();
  tap();
  expect(screen.queryByText('First line.')).not.toBeInTheDocument();
  tap();
  expect(screen.getByText('Second line.')).toBeVisible();
  expect(onAdvance).not.toHaveBeenCalled();
  tap();
  expect(onAdvance).toHaveBeenCalledTimes(1);
});

it('choices appear only after the last beat finishes', () => {
  const e = structuredClone(raw) as unknown as Episode;
  e.scenes[0].choices = [{ id: 'yes', text: 'Yes', nextSceneId: 'b' }];
  play(e);
  expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
  tap(); tap();
  expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
  tap();
  expect(screen.getByRole('button', { name: 'Yes' })).toBeVisible();
});

it('uses metadata for any episode and updates camera and character at beat boundary', () => {
  play();
  expect(screen.getByTestId('story-stage')).toHaveAttribute('data-camera', 'wide');
  expect(screen.queryByTestId('stage-character')).not.toBeInTheDocument();
  tap(); tap();
  expect(screen.getByTestId('story-stage')).toHaveAttribute('data-camera', 'close');
  expect(screen.getByTestId('stage-character')).toHaveAttribute('data-emotion', 'surprised');
  expect(screen.getByTestId('stage-character')).toHaveAttribute('data-position', 'left');
});

it('ignores a browser double-click second event instead of skipping the completed line', () => {
  play(); tap();
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }), { detail: 2 });
  expect(screen.getByText('First line.')).toBeVisible();
});

it('locks advance synchronously while saving and preserves the final beat', async () => {
  let release!: () => void;
  const onAdvance = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
  play(raw as unknown as Episode, onAdvance);
  tap(); tap(); tap(); tap(); tap();
  expect(onAdvance).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Second line.')).toBeVisible();
  await act(async () => release());
});

it('resets local beats when the saved scene changes and handles terminal without hook-order errors', () => {
  const view = play(); tap(); tap(); tap();
  view.rerender(<StoryScreen episode={raw as unknown as Episode} sceneId="b" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />);
  view.rerender(<StoryScreen episode={raw as unknown as Episode} sceneId="a" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />);
  tap();
  expect(screen.getByText('First line.')).toBeVisible();
});

it('shows text immediately with reduced motion while preserving beat progression', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { onAdvance } = play();
  expect(screen.getByText('First line.')).toBeVisible();
  tap();
  expect(screen.getByText('Second line.')).toBeVisible();
  expect(onAdvance).not.toHaveBeenCalled();
});

it('parses beat overrides and rejects malformed presentation rather than silently dropping it', () => {
  const parsed = parseEpisode(raw) as unknown as typeof raw;
  expect(parsed.scenes[0].beats?.[1].presentation?.camera).toBe('close');
  expect(() => parseEpisode({ ...raw, scenes: [{ ...raw.scenes[0], beats: [] }] })).toThrow();
  expect(() => parseEpisode({ ...raw, scenes: [{ ...raw.scenes[0], presentation: { camera: 'wrong' } }] })).toThrow();
});

it('plays terminal beats before the offer without advancing or saving another logical scene', () => {
  const onAdvance = vi.fn();
  render(<StoryScreen episode={raw as unknown as Episode} sceneId="b" state={state} onChoose={vi.fn()} onAdvance={onAdvance} />);
  expect(screen.queryByText('История только начинается')).not.toBeInTheDocument();
  tap();
  expect(screen.getByText('End')).toBeVisible();
  tap();
  expect(screen.getByText('История только начинается')).toBeVisible();
  expect(onAdvance).not.toHaveBeenCalled();
});

it('retires the previous transparent pose after crossfade even with reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const e = structuredClone(raw) as unknown as Episode;
  const actor = e.scenes[0].beats![1].presentation!.characters![0];
  e.scenes[0].presentation!.characters = [{ ...actor, src: 'art/old.webp' }];
  play(e);
  fireEvent.load(document.querySelector('img[src="/art/old.webp"]')!);
  act(() => vi.advanceTimersByTime(400));
  tap();
  fireEvent.load(document.querySelector('img[src="/art/mina.webp"]')!);
  act(() => vi.advanceTimersByTime(400));
  expect(document.querySelector('img[src="/art/old.webp"]')).not.toBeInTheDocument();
});
