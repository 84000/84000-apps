import {
  type Comment,
  type CommentDTO,
  commentFromDTO,
  commentToDTO,
  commentsFromDTO,
  isCommentEntityType,
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
};

const replyDTO: CommentDTO = {
  ...rootDTO,
  uuid: 'c-2',
  parent_uuid: 'c-1',
  content: 'it is',
  user_uuid: 'u-2',
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
    });
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
