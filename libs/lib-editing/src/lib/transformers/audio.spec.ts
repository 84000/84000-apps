import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';
import { recurseForType } from './recurse';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Listen to the audio recording.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 9,
      type: 'audio',
      uuid: 'audio-uuid-1',
      start: 9,
      content: [
        {
          src: 'https://example.com/audio.mp3',
        },
        {
          'media-type': 'audio/mpeg',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('audio transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform audio annotation correctly', () => {
    const audioNode = recurseForType({
      until: 'audio',
      block,
    });
    expect(audioNode).toBeDefined();
    expect(audioNode?.type).toBe('audio');
    expect(audioNode?.attrs?.src).toBe('https://example.com/audio.mp3');
    expect(audioNode?.attrs?.mediaType).toBe('audio/mpeg');
    expect(audioNode?.attrs?.uuid).toBe('audio-uuid-1');
  });
});
