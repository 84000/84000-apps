import { formatAttestation, termDefinition } from './definition';

describe('termDefinition', () => {
  it('follows the rend rules', () => {
    expect(termDefinition('work', 'std', null)).toBe('work');
    expect(termDefinition(null, 'std', null)).toBe('');
    expect(termDefinition('work', 'std', 'overrideWithStandard')).toBe('std');
    expect(termDefinition('work', 'std', 'incompatibleWithStandard')).toBe(
      'work',
    );
    expect(termDefinition('work', 'std', 'appendWithStandard')).toBe(
      'work std',
    );
    expect(termDefinition('work', 'std', 'prependWithStandard')).toBe(
      'std work',
    );
    expect(termDefinition('work', 'std', 'bothWithStandard')).toBe('std work');
  });

  it('does not repeat a standard definition the work already quotes', () => {
    expect(
      termDefinition('<p>see std here</p>', '<i>std</i>', 'appendWithStandard'),
    ).toBe('<p>see std here</p>');
  });

  it('is empty when either side of a combination is null, as SQL concatenation is', () => {
    expect(termDefinition(null, 'std', 'appendWithStandard')).toBe('');
    expect(termDefinition('work', null, 'prependWithStandard')).toBe('');
  });
});

describe('formatAttestation', () => {
  it('splits camel case and title-cases words', () => {
    expect(formatAttestation('sourceUnspecified')).toBe('Source Unspecified');
    expect(formatAttestation('attestedSource')).toBe('Attested Source');
    expect(formatAttestation('reconstructedSemantic')).toBe(
      'Reconstructed Semantic',
    );
  });

  it('is null for blank input', () => {
    expect(formatAttestation(null)).toBeNull();
    expect(formatAttestation('  ')).toBeNull();
  });
});
