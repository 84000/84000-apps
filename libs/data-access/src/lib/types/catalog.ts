/**
 * Canonical sections of the Kangyur and Tengyur.
 *
 * Sections live in `catalogs` filtered to `type = 'canonicalSection'` — there is
 * no `canon_sections` table. They nest (The Kangyur > Discourses > General Sūtra
 * Section), and a section's works hang off the leaves, so a section near the root
 * commonly has no works of its own and every work in its subtree.
 */
export type CanonSectionDTO = {
  uuid: string;
  label: string | null;
  xml_id: string | null;
  parent_uuid: string | null;
  parent_label: string | null;
  toh_range: string | null;
  has_children: boolean;
  direct_work_count: number | null;
  descendant_work_count: number | null;
};

export type CanonSection = {
  uuid: string;
  label: string;
  xmlId?: string;
  parentUuid?: string;
  /** The parent's label, so a caller can tell same-named siblings apart. */
  parentLabel?: string;
  /** Display string as catalogued, e.g. "Toh 502–808". Not parseable as a range. */
  tohRange?: string;
  hasChildren: boolean;
  /** Works mapped directly to this section, excluding its subtree. */
  directWorkCount: number;
  /** Distinct works across this section and every section beneath it. */
  descendantWorkCount: number;
};

const count = (value: number | null): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const canonSectionFromDTO = (dto: CanonSectionDTO): CanonSection => ({
  uuid: dto.uuid,
  label: dto.label || '<Unlabelled section>',
  xmlId: dto.xml_id ?? undefined,
  parentUuid: dto.parent_uuid ?? undefined,
  parentLabel: dto.parent_label ?? undefined,
  tohRange: dto.toh_range ?? undefined,
  hasChildren: dto.has_children,
  directWorkCount: count(dto.direct_work_count),
  descendantWorkCount: count(dto.descendant_work_count),
});

export const canonSectionsFromDTO = (dtos: CanonSectionDTO[]): CanonSection[] =>
  dtos.map(canonSectionFromDTO);
