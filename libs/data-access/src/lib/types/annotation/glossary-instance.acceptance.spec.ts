/**
 * Acceptance tests for DEV-907, "Glossary instances store only the glossary
 * uuid, not the authority", written from TASK.md alone. Each test names the
 * criterion it covers:
 *
 *  AC1  editor saves: stored content holds the glossary uuid, no `authority`
 *  AC2  MCP writes: an instance with only a `glossary` uuid is accepted and
 *       stores no `authority`; a sent `authority` is ignored and not stored
 *  AC3  re-saving an old instance writes it without `authority`
 *  AC4  an instance with no `authority` loads and is kept
 *  AC5  an old instance that still carries `authority` loads as before
 *
 * Stored annotation content is JSON, so "no authority key" is checked on the
 * JSON round trip, which is what the database holds.
 */
import {
  annotationFromDTO,
  annotationFromImport,
  annotationToDTO,
} from '../../../index';
import type { Annotation } from './annotation';
import type { AnnotationDTO } from './annotation-type';

const GLOSSARY = 'a1a1a1a1-0000-4000-8000-000000000001';
const AUTHORITY = 'b2b2b2b2-0000-4000-8000-000000000002';

const base = {
  start: 4,
  end: 10,
  passageUuid: 'p1',
  passageText: 'The Buddha',
};

const dtoWith = (content: Record<string, unknown>[]): AnnotationDTO => ({
  uuid: 'gi-1',
  passage_uuid: 'p1',
  type: 'glossary-instance',
  start: 4,
  end: 10,
  content,
});

/** What the database would hold for the row, after JSON serialization. */
const stored = (annotation: Annotation | null | undefined) => {
  expect(annotation).toBeTruthy();
  const dto = annotationToDTO(annotation as Annotation);
  expect(dto).toBeDefined();
  return JSON.parse(JSON.stringify(dto)) as AnnotationDTO;
};

const keysOf = (dto: AnnotationDTO) =>
  dto.content.flatMap((part) => Object.keys(part as object));

const glossaryOf = (annotation: Annotation) =>
  (annotation as unknown as { glossary?: string }).glossary;

describe('glossary-instance annotation, DTO to domain', () => {
  it('[AC4] loads an instance whose content holds only the glossary uuid', () => {
    const annotation = annotationFromDTO(dtoWith([{ uuid: GLOSSARY }]), 10);

    expect(annotation.type).toBe('glossaryInstance');
    expect(glossaryOf(annotation)).toBe(GLOSSARY);
    expect(annotation.uuid).toBe('gi-1');
    expect([annotation.start, annotation.end]).toEqual([4, 10]);
    expect(annotation.validated).not.toBe(false);
  });

  it('[AC5] loads an old instance carrying authority in the same element', () => {
    const annotation = annotationFromDTO(
      dtoWith([{ uuid: GLOSSARY, authority: AUTHORITY }]),
      10,
    );

    expect(annotation.type).toBe('glossaryInstance');
    expect(glossaryOf(annotation)).toBe(GLOSSARY);
  });

  it('[AC5] loads an old instance carrying authority in a separate element', () => {
    const annotation = annotationFromDTO(
      dtoWith([{ uuid: GLOSSARY }, { authority: AUTHORITY }]),
      10,
    );

    expect(annotation.type).toBe('glossaryInstance');
    expect(glossaryOf(annotation)).toBe(GLOSSARY);
  });
});

describe('glossary-instance annotation, domain to stored DTO', () => {
  it('[AC1][AC4] an instance with no authority is stored as the glossary uuid alone', () => {
    const annotation = annotationFromDTO(dtoWith([{ uuid: GLOSSARY }]), 10);
    const row = stored(annotation);

    expect(row.type).toBe('glossary-instance');
    expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
    expect(keysOf(row)).not.toContain('authority');
  });

  it('[AC3] re-saving an old instance (same element) writes no authority', () => {
    const annotation = annotationFromDTO(
      dtoWith([{ uuid: GLOSSARY, authority: AUTHORITY }]),
      10,
    );
    const row = stored(annotation);

    expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
    expect(keysOf(row)).not.toContain('authority');
    expect(JSON.stringify(row)).not.toContain(AUTHORITY);
  });

  it('[AC3] re-saving an old instance (separate element) writes no authority', () => {
    const annotation = annotationFromDTO(
      dtoWith([{ uuid: GLOSSARY }, { authority: AUTHORITY }]),
      10,
    );
    const row = stored(annotation);

    expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
    expect(keysOf(row)).not.toContain('authority');
    expect(JSON.stringify(row)).not.toContain(AUTHORITY);
  });

  it('[AC1][AC3] a domain instance that still carries an authority value is stored without it', () => {
    // A writer that has not stopped setting the field must not get it stored.
    const annotation = {
      ...annotationFromDTO(dtoWith([{ uuid: GLOSSARY }]), 10),
      authority: AUTHORITY,
    } as unknown as Annotation;
    const row = stored(annotation);

    expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
    expect(JSON.stringify(row)).not.toContain(AUTHORITY);
    expect(keysOf(row)).not.toContain('authority');
  });
});

describe('glossary-instance annotation, import (the MCP write path)', () => {
  it('[AC2] accepts an instance with only a glossary uuid', () => {
    const annotation = annotationFromImport('glossary-instance', {
      ...base,
      data: { glossary: GLOSSARY },
    });

    expect(annotation).not.toBeNull();
    expect(annotation?.type).toBe('glossaryInstance');
    expect(glossaryOf(annotation as Annotation)).toBe(GLOSSARY);
    expect([annotation?.start, annotation?.end]).toEqual([4, 10]);
  });

  it('[AC2] stores no authority for an instance sent with only a glossary uuid', () => {
    const row = stored(
      annotationFromImport('glossary-instance', {
        ...base,
        data: { glossary: GLOSSARY },
      }),
    );

    expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
    expect(keysOf(row)).not.toContain('authority');
  });

  it('[AC2] ignores an authority the caller sends, and does not store it', () => {
    const annotation = annotationFromImport('glossary-instance', {
      ...base,
      data: { glossary: GLOSSARY, authority: AUTHORITY },
    });

    // Still accepted, and still linked to the entry by its glossary uuid.
    expect(annotation).not.toBeNull();
    expect(glossaryOf(annotation as Annotation)).toBe(GLOSSARY);

    const row = stored(annotation);
    expect(row.content.some((part) => part.uuid === GLOSSARY)).toBe(true);
    expect(keysOf(row)).not.toContain('authority');
    expect(JSON.stringify(row)).not.toContain(AUTHORITY);
  });

  it('[AC2] still refuses an instance with no glossary uuid', () => {
    // The glossary uuid is the one thing an instance needs.
    expect(
      annotationFromImport('glossary-instance', {
        ...base,
        data: { authority: AUTHORITY },
      }),
    ).toBeNull();
    expect(annotationFromImport('glossary-instance', base)).toBeNull();
  });

  it('[AC2] keeps the stored identity when an existing instance is sent back without authority', () => {
    const annotation = annotationFromImport('glossary-instance', {
      ...base,
      uuid: 'gi-existing',
      data: { glossary: GLOSSARY },
    });

    expect(annotation?.uuid).toBe('gi-existing');
  });
});
