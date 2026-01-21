import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { abbreviation } from './abbreviation';
import { blockFromPassage } from '../block';
import { recurseForType } from './recurse';

const dto: PassageDTO = {
  sort: 13140,
  type: 'abbreviations',
  uuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
  label: '',
  xmlId: 'UT22084-001-001-2226',
  parent: 'UT22084-001-001-notes-1',
  content: 'C Choné',
  work_uuid: '092e9a3c-12a6-4e1c-a05b-16835c0e62a8',
  annotations: [
    {
      end: 2,
      type: 'abbreviation',
      uuid: '49c41c6d-0e04-412e-81ad-22f3af377470',
      start: 0,
      content: [
        {
          uuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
        },
      ],
      passage_uuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
    },
    {
      end: 7,
      type: 'has-abbreviation',
      uuid: '1e5003e8-e015-4b94-b88c-80b39c263098',
      start: 2,
      content: [
        {
          uuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
        },
      ],
      passage_uuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
    },
  ],
};

describe('abbreviation transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || []),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform abbreviation annotation correctly', () => {
    const annotation = passage.annotations.find(
      (a: Annotation) => a.type === 'abbreviation',
    ) as Annotation;
    abbreviation({
      root: block,
      parent: block,
      block,
      annotation,
    });

    const val = recurseForType({
      until: 'abbreviation',
      block,
    });

    expect(val).toBeDefined();
    expect(val?.type).toBe('abbreviation');
    expect(val?.attrs).toBeDefined();
    expect(val?.attrs?.abbreviation).toBe(
      'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
    );
    expect(val?.attrs?.uuid).toBe('49c41c6d-0e04-412e-81ad-22f3af377470');
    expect(val?.content).toBeDefined();
    expect(val?.content?.length).toBe(1);
    expect(val?.content?.[0].type).toBe('text');
    expect(val?.content?.[0].text).toBe('C ');
  });
});
