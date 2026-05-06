import { jsonResult, errorResult } from './util';

describe('jsonResult', () => {
  it('wraps data as JSON text content', () => {
    const result = jsonResult({ foo: 'bar' });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ foo: 'bar' }, null, 2) },
    ]);
    expect(result.isError).toBeUndefined();
  });
});

describe('errorResult', () => {
  it('returns error content with isError flag', () => {
    const result = errorResult('something went wrong');
    expect(result.content).toEqual([
      { type: 'text', text: 'something went wrong' },
    ]);
    expect(result.isError).toBe(true);
  });
});
