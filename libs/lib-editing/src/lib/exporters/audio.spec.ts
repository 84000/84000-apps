import type { Node } from '@tiptap/pm/model';
import { audio } from './audio';

describe('audio exporter', () => {
  it('should export audio annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'audio-uuid-1234',
        src: '/audio/recitation.mp3',
        mediaType: 'audio/mpeg',
      },
    } as unknown as Node;

    const result = audio({
      node,
      parent: node,
      root: node,
      start: 50,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'audio-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'audio',
      start: 50,
      end: 50,
      src: '/audio/recitation.mp3',
      mediaType: 'audio/mpeg',
    });
  });

  it('should default to audio/mpeg when mediaType is missing', () => {
    const node = {
      attrs: {
        uuid: 'audio-uuid-5678',
        src: '/audio/recitation.mp3',
      },
    } as unknown as Node;

    const result = audio({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'audio-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'audio',
      start: 0,
      end: 0,
      src: '/audio/recitation.mp3',
      mediaType: 'audio/mpeg',
    });
  });

  it('should return undefined when src is missing', () => {
    const node = {
      attrs: {
        uuid: 'audio-uuid-nosrc',
      },
    } as unknown as Node;

    const result = audio({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
