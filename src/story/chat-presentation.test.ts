import { describe, expect, it } from 'vitest';
import { parseEpisode } from './schema';

describe('scene chat presentation', () => {
  it('parses structured chat messages and typing state', () => {
    const episode = parseEpisode({
      id: 'chat-episode',
      title: 'Chat',
      startSceneId: 'chat',
      scenes: [{
        id: 'chat',
        kind: 'message',
        text: 'fallback',
        chat: {
          status: 'была в сети очень давно',
          typing: true,
          messages: [
            { from: 'soa', text: 'Ты живёшь напротив него?' },
            { from: 'lera', text: 'Кто ты?', meta: 'прочитано' },
            { from: 'system', text: 'SOA печатает…' },
          ],
        },
        nextSceneId: 'end',
      }, {
        id: 'end',
        kind: 'terminal',
        text: 'end',
      }],
    });

    const chat = (episode.scenes[0] as unknown as {
      chat?: { status?: string; typing?: boolean; messages?: Array<{ from: string; text: string; meta?: string }> };
    }).chat;

    expect(chat?.status).toBe('была в сети очень давно');
    expect(chat?.typing).toBe(true);
    expect(chat?.messages).toEqual([
      { from: 'soa', text: 'Ты живёшь напротив него?' },
      { from: 'lera', text: 'Кто ты?', meta: 'прочитано' },
      { from: 'system', text: 'SOA печатает…' },
    ]);
  });
});
