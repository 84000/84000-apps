import {
  type Comment,
  type CommentDTO,
  commentFromDTO,
  commentToDTO,
  commentsFromDTO,
  isCommentEntityType,
  normalizeCommentTag,
  threadsFromComments,
} from './comment';

const rootDTO: CommentDTO = {
  uuid: 'c-1',
  parent_uuid: null,
  entity_uuid: 'p-1',
  entity_type: 'passage',
  content: 'is this rendering right?',
  user_uuid: 'u-1',
  created_at: '2026-09-10T10:00:00+00:00',
  updated_at: '2026-09-10T10:00:00+00:00',
  resolved_at: null,
  resolved_by: null,
  tags: [],
};

const replyDTO: CommentDTO = {
  ...rootDTO,
  uuid: 'c-2',
  parent_uuid: 'c-1',
  content: 'it is',
  user_uuid: 'u-2',
  tags: ['pending'],
  created_at: '2026-09-10T11:00:00+00:00',
  updated_at: '2026-09-10T11:00:00+00:00',
};

const resolvedRootDTO: CommentDTO = {
  ...rootDTO,
  uuid: 'c-3',
  created_at: '2026-09-10T09:00:00+00:00',
  updated_at: '2026-09-10T12:00:00+00:00',
  resolved_at: '2026-09-10T12:00:00+00:00',
  resolved_by: 'u-2',
};

describe('commentFromDTO', () => {
  it('maps the stored columns onto the domain shape', () => {
    expect(commentFromDTO(rootDTO)).toEqual({
      uuid: 'c-1',
      entityUuid: 'p-1',
      entityType: 'passage',
      content: 'is this rendering right?',
      userUuid: 'u-1',
      createdAt: '2026-09-10T10:00:00+00:00',
      updatedAt: '2026-09-10T10:00:00+00:00',
      tags: [],
    });
  });

  it('reads missing tags as none', () => {
    const { tags: _tags, ...untagged } = rootDTO;
    expect(commentFromDTO({ ...untagged, tags: null }).tags).toEqual([]);
    expect(commentFromDTO(untagged).tags).toEqual([]);
  });

  it('carries tags on a reply', () => {
    expect(commentFromDTO(replyDTO).tags).toEqual(['pending']);
  });

  it('drops nulls rather than carrying them through', () => {
    const comment = commentFromDTO(rootDTO);

    // `in` rather than a null comparison: the fields must be absent, since the
    // GraphQL layer and the resolved/unresolved checks both test presence.
    expect('parentUuid' in comment).toBe(false);
    expect('resolvedAt' in comment).toBe(false);
    expect('resolvedBy' in comment).toBe(false);
  });

  it('carries resolution and parentage when set', () => {
    expect(commentFromDTO(replyDTO).parentUuid).toBe('c-1');
    expect(commentFromDTO(resolvedRootDTO)).toMatchObject({
      resolvedAt: '2026-09-10T12:00:00+00:00',
      resolvedBy: 'u-2',
    });
  });
});

describe('comment round trip', () => {
  it.each([
    ['an unresolved root', rootDTO],
    ['a reply', replyDTO],
    ['a resolved root', resolvedRootDTO],
  ])('restores %s through fromDTO and back', (_label, dto) => {
    // Nulls come back absent, which is the one intended asymmetry: PostgREST
    // omits an absent key on write and returns null on read, so both encode
    // "unset".
    const { parent_uuid, resolved_at, resolved_by, ...stored } = dto;
    const expected: CommentDTO = { ...stored };
    if (parent_uuid) expected.parent_uuid = parent_uuid;
    if (resolved_at) expected.resolved_at = resolved_at;
    if (resolved_by) expected.resolved_by = resolved_by;

    expect(commentToDTO(commentFromDTO(dto))).toEqual(expected);
  });

  it('does not write replies back, since the tree is a projection', () => {
    const root: Comment = {
      ...commentFromDTO(rootDTO),
      replies: [commentFromDTO(replyDTO)],
    };

    expect('replies' in commentToDTO(root)).toBe(false);
  });
});

describe('commentsFromDTO', () => {
  it('returns empty for missing input', () => {
    expect(commentsFromDTO()).toEqual([]);
  });
});

describe('normalizeCommentTag', () => {
  it.each([
    ['pending', 'pending'],
    ['  Pending ', 'pending'],
    ['needs   Toh 123', 'needs toh 123'],
    ['', null],
    ['   ', null],
    ['x'.repeat(41), null],
  ])('normalizes %j to %j', (value, expected) => {
    expect(normalizeCommentTag(value)).toBe(expected);
  });
});

describe('isCommentEntityType', () => {
  it.each([
    ['passage', true],
    ['glossary', false],
    ['', false],
    [undefined, false],
    [42, false],
  ])('narrows %s to %s', (value, expected) => {
    expect(isCommentEntityType(value)).toBe(expected);
  });
});

describe('threadsFromComments', () => {
  it('hangs replies off their root and returns roots oldest first', () => {
    const threads = threadsFromComments(
      commentsFromDTO([replyDTO, rootDTO, resolvedRootDTO]),
    );

    expect(threads.map(({ uuid }) => uuid)).toEqual(['c-3', 'c-1']);
    expect(threads[1].replies?.map(({ uuid }) => uuid)).toEqual(['c-2']);
    expect('replies' in threads[0]).toBe(false);
  });

  it('leaves the input untouched', () => {
    const comments = commentsFromDTO([rootDTO, replyDTO]);

    threadsFromComments(comments);

    expect(comments.some((comment) => 'replies' in comment)).toBe(false);
  });

  it('nests beyond one level, since threads are not depth limited', () => {
    const chain = commentsFromDTO(
      Array.from({ length: 5 }, (_, i) => ({
        ...rootDTO,
        uuid: `d-${i}`,
        parent_uuid: i === 0 ? null : `d-${i - 1}`,
        created_at: `2026-09-10T1${i}:00:00+00:00`,
      })),
    );

    const [thread] = threadsFromComments(chain, 4);

    expect(thread.replies?.[0].uuid).toBe('d-1');
    expect(thread.replies?.[0].replies?.[0].uuid).toBe('d-2');
    expect(thread.replies?.[0].replies?.[0].replies?.[0].uuid).toBe('d-3');
  });

  it('truncates at maxDepth but still reports what lies below', () => {
    const chain = commentsFromDTO(
      Array.from({ length: 4 }, (_, i) => ({
        ...rootDTO,
        uuid: `d-${i}`,
        parent_uuid: i === 0 ? null : `d-${i - 1}`,
        created_at: `2026-09-10T1${i}:00:00+00:00`,
      })),
    );

    const [thread] = threadsFromComments(chain, 1);

    expect(thread.replies?.[0].uuid).toBe('d-1');
    expect(thread.replies?.[0].replies).toBeUndefined();
    // The branch continues; the response simply stopped.
    expect(thread.replies?.[0].replyCount).toBe(1);
  });

  it('counts direct replies, not descendants', () => {
    const [thread] = threadsFromComments(
      commentsFromDTO([
        rootDTO,
        replyDTO,
        { ...replyDTO, uuid: 'c-4', parent_uuid: 'c-2' },
      ]),
    );

    expect(thread.replyCount).toBe(1);
    expect(thread.replies?.[0].replyCount).toBe(1);
  });

  it('terminates on a parent cycle rather than spinning', () => {
    const threads = threadsFromComments(
      commentsFromDTO([
        { ...rootDTO, uuid: 'a', parent_uuid: 'b' },
        { ...rootDTO, uuid: 'b', parent_uuid: 'a' },
      ]),
    );

    // Neither is a root, so neither is returned — but the build returns.
    expect(threads).toEqual([]);
  });

  it('drops an orphan reply rather than promoting it to a root', () => {
    // A truncated read or a deleted root would otherwise surface someone's reply
    // as a top-level thread.
    const threads = threadsFromComments(commentsFromDTO([replyDTO]));

    expect(threads).toEqual([]);
  });

  it('breaks ties on created_at with the uuid, so ordering is total', () => {
    const sameInstant: CommentDTO = { ...rootDTO, uuid: 'c-0' };

    const threads = threadsFromComments(
      commentsFromDTO([rootDTO, sameInstant]),
    );

    expect(threads.map(({ uuid }) => uuid)).toEqual(['c-0', 'c-1']);
  });
});
