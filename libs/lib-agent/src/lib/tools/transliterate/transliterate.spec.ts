import { z } from 'zod';
import { toEwts } from '@eightyfourthousand/lib-tibetan';
import { createTransliterateTool } from '.';

describe('transliterate tool', () => {
  const tool = createTransliterateTool();
  const extra = {} as Parameters<typeof tool.handler>[1];
  const call = async (args: { text: string; finalShad?: 'keep' | 'drop' }) => {
    const result = await tool.handler({ finalShad: 'keep', ...args }, extra);
    return JSON.parse((result.content[0] as { text: string }).text);
  };

  it('is read-only and needs no data', () => {
    expect(tool.name).toBe('transliterate');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns house-profile EWTS', async () => {
    await expect(call({ text: 'བསྒྱུར་བའོ། །སླད་ཀྱིས' })).resolves.toEqual({
      ewts: 'bsgyur ba’o/ /slad kyis',
    });
  });

  it('drops the final shad for a title', async () => {
    await expect(
      call({ text: 'ལྕང་ལོ་ཅན།', finalShad: 'drop' }),
    ).resolves.toEqual({ ewts: 'lcang lo can' });
  });

  it('returns exactly what the shared converter does', async () => {
    const text = 'ཨོཾ་བཛྲ་ཏཱིཀྵྞ་དུཿཁ་ཙྪེ་ད། པདྨ་ཏནྟྲ།';
    const { ewts } = await call({ text });
    expect(ewts).toBe(toEwts(text));
  });

  it('reports warnings when there are any', async () => {
    const result = await call({ text: 'ཀ༓' });
    expect(result.ewts).toBe('ka\\u0F13');
    expect(result.warnings).toHaveLength(1);
  });

  it('defaults finalShad to keep', () => {
    const finalShad = tool.inputSchema['finalShad'] as z.ZodType;
    expect(finalShad.parse(undefined)).toBe('keep');
  });
});
