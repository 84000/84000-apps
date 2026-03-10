import { incrementLabel, decrementLabel } from './label';

describe('incrementLabel', () => {
  it('should increment the last component of a dotted label', () => {
    expect(incrementLabel('1.5')).toBe('1.6');
  });

  it('should increment a single-component label', () => {
    expect(incrementLabel('3')).toBe('4');
  });

  it('should increment a deeply nested label', () => {
    expect(incrementLabel('1.2.3')).toBe('1.2.4');
  });

  it('should increment at a specific depth', () => {
    expect(incrementLabel('1.5', 0)).toBe('2.5');
  });

  it('should increment the middle component of a three-part label', () => {
    expect(incrementLabel('1.5.3', 1)).toBe('1.6.3');
  });

  it('should handle zero as the last component', () => {
    expect(incrementLabel('1.0')).toBe('1.1');
  });

  it('should handle empty string', () => {
    expect(incrementLabel('')).toBe('1');
  });
});

describe('decrementLabel', () => {
  it('should decrement the last component of a dotted label', () => {
    expect(decrementLabel('1.5')).toBe('1.4');
  });

  it('should decrement a single-component label', () => {
    expect(decrementLabel('3')).toBe('2');
  });

  it('should decrement a deeply nested label', () => {
    expect(decrementLabel('1.2.3')).toBe('1.2.2');
  });

  it('should decrement at a specific depth', () => {
    expect(decrementLabel('1.5', 0)).toBe('0.5');
  });

  it('should decrement the middle component of a three-part label', () => {
    expect(decrementLabel('1.5.3', 1)).toBe('1.4.3');
  });

  it('should clamp at zero and not go negative', () => {
    expect(decrementLabel('1.0')).toBe('1.0');
  });

  it('should clamp a single zero', () => {
    expect(decrementLabel('0')).toBe('0');
  });

  it('should handle empty string', () => {
    expect(decrementLabel('')).toBe('0');
  });
});

describe('incrementLabel and decrementLabel are inverses', () => {
  it('decrement after increment returns the original label', () => {
    const original = '1.5';
    expect(decrementLabel(incrementLabel(original))).toBe(original);
  });

  it('increment after decrement returns the original label', () => {
    const original = '2.3';
    expect(incrementLabel(decrementLabel(original))).toBe(original);
  });

  it('roundtrips at a specific depth', () => {
    const original = '4.7.2';
    expect(decrementLabel(incrementLabel(original, 1), 1)).toBe(original);
  });
});
