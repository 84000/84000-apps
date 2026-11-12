import type { GraphQLContext } from '../../context';
import { removeGlossaryTermInstancesMutation } from './glossary.mutation';

const mockRequireEditorEditPermission = jest.fn();
const mockRemoveGlossaryTermInstances = jest.fn();
jest.mock('../../context', () => ({
  requireEditorEditPermission: (...args: unknown[]) =>
    mockRequireEditorEditPermission(...args),
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  removeGlossaryTermInstances: (...args: unknown[]) =>
    mockRemoveGlossaryTermInstances(...args),
}));

const ctx = { supabase: {} } as unknown as GraphQLContext;
const args = { workUuid: 'w', termUuid: 't', annotationUuids: ['a1'] };

describe('removeGlossaryTermInstancesMutation', () => {
  beforeEach(() => {
    mockRequireEditorEditPermission.mockReset();
    mockRemoveGlossaryTermInstances.mockReset();
  });

  it('removes nothing without editor.edit', async () => {
    mockRequireEditorEditPermission.mockResolvedValue({
      ok: false,
      error: 'Permission denied: editor.edit required',
    });

    const result = await removeGlossaryTermInstancesMutation(null, args, ctx);

    expect(result).toEqual({
      removed: [],
      failed: [],
      passages: [],
      error: 'Permission denied: editor.edit required',
    });
    expect(mockRemoveGlossaryTermInstances).not.toHaveBeenCalled();
  });

  it('removes the instances asked for with the caller’s client', async () => {
    mockRequireEditorEditPermission.mockResolvedValue({ ok: true });
    const removal = { removed: ['a1'], failed: [], passages: [] };
    mockRemoveGlossaryTermInstances.mockResolvedValue(removal);

    expect(await removeGlossaryTermInstancesMutation(null, args, ctx)).toBe(
      removal,
    );
    expect(mockRemoveGlossaryTermInstances).toHaveBeenCalledWith({
      client: {},
      ...args,
    });
  });
});
