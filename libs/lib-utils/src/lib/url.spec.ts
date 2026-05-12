import { safeHref } from './url';

describe('safeHref', () => {
  it('returns undefined for empty/missing input', () => {
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
    expect(safeHref('   ')).toBeUndefined();
  });

  it('allows relative paths', () => {
    expect(safeHref('/foo')).toBe('/foo');
    expect(safeHref('/foo/bar?q=1')).toBe('/foo/bar?q=1');
  });

  it('allows hash links', () => {
    expect(safeHref('#anchor')).toBe('#anchor');
  });

  it('allows http(s) and mailto', () => {
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('https://example.com/path')).toBe('https://example.com/path');
    expect(safeHref('mailto:a@b.co')).toBe('mailto:a@b.co');
  });

  it('rejects unsafe protocols', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('  JavaScript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>')).toBeUndefined();
    expect(safeHref('vbscript:msgbox')).toBeUndefined();
    expect(safeHref('file:///etc/passwd')).toBeUndefined();
  });

  it('trims surrounding whitespace before evaluating', () => {
    expect(safeHref('  https://example.com  ')).toBe('https://example.com');
    expect(safeHref('  /foo  ')).toBe('/foo');
  });
});
