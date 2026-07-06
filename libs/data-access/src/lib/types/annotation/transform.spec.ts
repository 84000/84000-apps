import { annotationsFromDTO } from './transform';
import type { AnnotationDTO } from './dto';

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
});
