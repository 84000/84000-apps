import { annotationRangeFits } from './range';
import { annotationsFromDTO } from './transform';
import type { AnnotationDTO } from './annotation-type';

const spanDTO = (start: number, end: number): AnnotationDTO => ({
  uuid: 'span-1',
  passage_uuid: 'passage-1',
  type: 'span',
  start,
  end,
  content: [{ 'text-style': 'emphasis' }],
});

describe('annotationsFromDTO range validation', () => {
  it('accepts an annotation spanning the full passage', () => {
    const [annotation] = annotationsFromDTO([spanDTO(0, 10)], 10);
    expect(annotation.validated).toBe(true);
  });

  it('accepts a zero-width annotation at the passage end', () => {
    const [annotation] = annotationsFromDTO([spanDTO(10, 10)], 10);
    expect(annotation.validated).toBe(true);
  });

  it('marks an annotation ending past the passage as invalid', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const [annotation] = annotationsFromDTO([spanDTO(0, 11)], 10);

    expect(annotation.validated).toBe(false);
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('marks an annotation with a negative start as invalid', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const [annotation] = annotationsFromDTO([spanDTO(-1, 5)], 10);

    expect(annotation.validated).toBe(false);
    consoleWarn.mockRestore();
  });

  it('marks every annotation invalid when the passage length is zero', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const [annotation] = annotationsFromDTO([spanDTO(0, 5)], 0);

    expect(annotation.validated).toBe(false);
    consoleWarn.mockRestore();
  });

  it('marks a reversed range as invalid', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const [annotation] = annotationsFromDTO([spanDTO(6, 3)], 10);

    expect(annotation.validated).toBe(false);
    consoleWarn.mockRestore();
  });

  it('checks the range of an unknown type too', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const [annotation] = annotationsFromDTO(
      [{ ...spanDTO(0, 11), type: 'no-such-type' as never }],
      10,
    );

    expect(annotation.validated).toBe(false);
    consoleWarn.mockRestore();
  });
});

describe('annotationRangeFits', () => {
  it.each([
    [0, 0, 0, true],
    [0, 10, 10, true],
    [3, 3, 10, true],
    [-1, 2, 10, false],
    [4, 2, 10, false],
    [0, 11, 10, false],
    [0.5, 2, 10, false],
    ['0', 2, 10, false],
    [undefined, 2, 10, false],
  ])('start %p, end %p, length %p: %p', (start, end, length, fits) => {
    expect(annotationRangeFits(start, end, length as number)).toBe(fits);
  });
});
