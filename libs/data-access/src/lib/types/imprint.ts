import { TranslationLanguage } from './language';
import { BACK_MATTER, BODY_MATTER, FRONT_MATTER } from './passage';
import { SemVer } from './semver';

export type Imprint = {
  uuid: string;
  toh: string;
  section?: string;
  version?: SemVer;
  restriction?: boolean;
  publishYear?: string;
  tibetanAuthors?: string[];
  isAuthorContested: boolean;
  sourceDescription?: string;
  publisherStatement?: string;
  tibetanTranslators?: string;
  license: {
    link?: string;
    name?: string;
    description?: string;
  };
  mainTitles?: Partial<{ [key in TranslationLanguage]: string }>;
  longTitles?: Partial<{ [key in TranslationLanguage]: string }>;
};

export type ImprintDTO = {
  work_uuid: string;
  toh: string;
  section?: string;
  version?: SemVer;
  restriction?: boolean;
  publishYear?: string;
  tibetanAuthors?: string;
  isAuthorContested?: boolean;
  sourceDescription?: string;
  publisherStatement?: string;
  tibetanTranslators?: string;
  license: {
    link?: string;
    name?: string;
    description?: string;
  };
  mainTitles?: Partial<{ [key in TranslationLanguage]: string }>;
  longTitles?: Partial<{ [key in TranslationLanguage]: string }>;
};

export const imprintFromDTO = (dto: ImprintDTO): Imprint => {
  return {
    uuid: dto.work_uuid,
    toh: dto.toh,
    section: dto.section,
    version: dto.version,
    restriction: dto.restriction,
    publishYear: dto.publishYear,
    tibetanAuthors: dto.tibetanAuthors
      ?.split(',')
      .map((author) => author.trim())
      .filter((author) => author.length > 0),
    isAuthorContested: dto.isAuthorContested || false,
    sourceDescription: dto.sourceDescription,
    publisherStatement: dto.publisherStatement,
    tibetanTranslators: dto.tibetanTranslators,
    license: {
      ...dto.license,
    },
    mainTitles: dto.mainTitles,
    longTitles: dto.longTitles,
  };
};

const ALL_SECTIONS = [...FRONT_MATTER, ...BODY_MATTER, ...BACK_MATTER];
export type TranslationSection = (typeof ALL_SECTIONS)[number];

export type TocEntryDTO = {
  uuid: string;
  content: string;
  label?: string;
  sort: number;
  section: TranslationSection;
  level: number;
};

export type TocDTO = TocEntryDTO[];

export type TocEntry = {
  uuid: string;
  content: string;
  label?: string;
  sort: number;
  level: number;
  section: TranslationSection;
  children: TocEntry[];
};

export type Toc = {
  frontMatter: TocEntry[];
  body: TocEntry[];
  backMatter: TocEntry[];
};

export const tocFromDTO = (dto: TocDTO): Toc => {
  // map by front matter, body matter, back matter based on constants above
  const frontMatter: TocEntry[] = [];
  const bodyMatter: TocEntry[] = [];
  const backMatter: TocEntry[] = [];

  const sectionMap: { [key in TranslationSection]: TocEntry[] } = {
    abbreviations: backMatter,
    acknowledgment: frontMatter,
    appendix: bodyMatter,
    colophon: bodyMatter,
    endnotes: backMatter,
    homage: bodyMatter,
    introduction: frontMatter,
    prelude: bodyMatter,
    prologue: bodyMatter,
    summary: frontMatter,
    translation: bodyMatter,
  };

  dto.forEach((entry) => {
    const tocEntry: TocEntry = {
      ...entry,
      children: [],
    };
    sectionMap[entry.section].push(tocEntry);
  });

  // within each section, create a hierarchy based on level from low to high
  const buildHierarchy = (entries: TocEntry[]): TocEntry[] => {
    const root: TocEntry = {
      uuid: 'root',
      content: '',
      sort: 0,
      level: 0,
      section: 'introduction',
      children: [],
    };
    const stack: TocEntry[] = [root];

    entries.sort((a, b) => a.sort - b.sort);

    entries.forEach((entry) => {
      while (stack.length > 1 && entry.level <= stack[stack.length - 1].level) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(entry);
      stack.push(entry);
    });

    return root.children;
  };

  return {
    frontMatter: buildHierarchy(frontMatter),
    body: buildHierarchy(bodyMatter),
    backMatter: buildHierarchy(backMatter),
  };
};
