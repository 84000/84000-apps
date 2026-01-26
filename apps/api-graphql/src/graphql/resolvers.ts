import {
  getTranslationsMetadata,
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
  getTranslationImprint,
  getTranslationPassages,
  type BodyItemType,
  type PaginationDirection,
} from '@data-access';
import type { GraphQLContext } from './context';

// Type for Work parent object in field resolvers
interface WorkParent {
  uuid: string;
  toh: string[];
  title: string;
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  section: string;
}

// Map GraphQL PassageType enum to database passage types
const PASSAGE_TYPE_MAP: Record<string, BodyItemType> = {
  ABBREVIATIONS: 'abbreviations',
  ABBREVIATIONS_HEADER: 'abbreviationsHeader',
  ACKNOWLEDGMENT: 'acknowledgment',
  ACKNOWLEDGMENT_HEADER: 'acknowledgmentHeader',
  APPENDIX: 'appendix',
  APPENDIX_HEADER: 'appendixHeader',
  COLOPHON: 'colophon',
  COLOPHON_HEADER: 'colophonHeader',
  ENDNOTES: 'endnotes',
  ENDNOTES_HEADER: 'endnotesHeader',
  HOMAGE: 'homage',
  HOMAGE_HEADER: 'homageHeader',
  INTRODUCTION: 'introduction',
  INTRODUCTION_HEADER: 'introductionHeader',
  PRELUDE: 'prelude',
  PRELUDE_HEADER: 'preludeHeader',
  PROLOGUE: 'prologue',
  PROLOGUE_HEADER: 'prologueHeader',
  SUMMARY: 'summary',
  SUMMARY_HEADER: 'summaryHeader',
  TRANSLATION: 'translation',
  TRANSLATION_HEADER: 'translationHeader',
  UNKNOWN: 'unknown',
};

// Map database passage types to GraphQL enum values
const PASSAGE_TYPE_TO_ENUM: Record<BodyItemType, string> = {
  abbreviations: 'ABBREVIATIONS',
  abbreviationsHeader: 'ABBREVIATIONS_HEADER',
  acknowledgment: 'ACKNOWLEDGMENT',
  acknowledgmentHeader: 'ACKNOWLEDGMENT_HEADER',
  appendix: 'APPENDIX',
  appendixHeader: 'APPENDIX_HEADER',
  colophon: 'COLOPHON',
  colophonHeader: 'COLOPHON_HEADER',
  endnotes: 'ENDNOTES',
  endnotesHeader: 'ENDNOTES_HEADER',
  homage: 'HOMAGE',
  homageHeader: 'HOMAGE_HEADER',
  introduction: 'INTRODUCTION',
  introductionHeader: 'INTRODUCTION_HEADER',
  prelude: 'PRELUDE',
  preludeHeader: 'PRELUDE_HEADER',
  prologue: 'PROLOGUE',
  prologueHeader: 'PROLOGUE_HEADER',
  summary: 'SUMMARY',
  summaryHeader: 'SUMMARY_HEADER',
  translation: 'TRANSLATION',
  translationHeader: 'TRANSLATION_HEADER',
  unknown: 'UNKNOWN',
};

// Map database annotation types to GraphQL enum values
const ANNOTATION_TYPE_TO_ENUM: Record<string, string> = {
  abbreviation: 'ABBREVIATION',
  audio: 'AUDIO',
  blockquote: 'BLOCKQUOTE',
  code: 'CODE',
  deprecated: 'DEPRECATED',
  endNoteLink: 'END_NOTE_LINK',
  glossaryInstance: 'GLOSSARY_INSTANCE',
  hasAbbreviation: 'HAS_ABBREVIATION',
  heading: 'HEADING',
  image: 'IMAGE',
  indent: 'INDENT',
  inlineTitle: 'INLINE_TITLE',
  internalLink: 'INTERNAL_LINK',
  leadingSpace: 'LEADING_SPACE',
  line: 'LINE',
  lineGroup: 'LINE_GROUP',
  link: 'LINK',
  list: 'LIST',
  listItem: 'LIST_ITEM',
  mantra: 'MANTRA',
  paragraph: 'PARAGRAPH',
  quote: 'QUOTE',
  quoted: 'QUOTED',
  reference: 'REFERENCE',
  span: 'SPAN',
  table: 'TABLE',
  tableBodyData: 'TABLE_BODY_DATA',
  tableBodyHeader: 'TABLE_BODY_HEADER',
  tableBodyRow: 'TABLE_BODY_ROW',
  trailer: 'TRAILER',
  unknown: 'UNKNOWN',
};

export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),

    version: () => '1.0.0',

    me: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      if (!ctx.session) {
        return null;
      }

      return {
        id: ctx.session.userId,
        email: ctx.session.email,
        role: ctx.session.claims.role.toUpperCase(),
      };
    },

    works: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const works = await getTranslationsMetadata({ client: ctx.supabase });
      return works.map((work) => ({
        ...work,
        publicationDate: work.publicationDate.toISOString(),
      }));
    },

    work: async (
      _parent: unknown,
      args: { uuid?: string; toh?: string },
      ctx: GraphQLContext,
    ) => {
      let work;
      if (args.uuid) {
        work = await getTranslationMetadataByUuid({
          client: ctx.supabase,
          uuid: args.uuid,
        });
      } else if (args.toh) {
        work = await getTranslationMetadataByToh({
          client: ctx.supabase,
          toh: args.toh,
        });
      } else {
        throw new Error('Either uuid or toh must be provided');
      }

      if (!work) return null;
      return {
        ...work,
        publicationDate: work.publicationDate.toISOString(),
      };
    },
  },

  Mutation: {
    _placeholder: () => true,
  },

  Work: {
    imprint: async (
      parent: WorkParent,
      args: { toh?: string },
      ctx: GraphQLContext,
    ) => {
      // Use provided toh or default to first toh in the work
      const toh = args.toh ?? parent.toh[0];

      if (!toh) {
        return null;
      }

      const imprint = await getTranslationImprint({
        client: ctx.supabase,
        uuid: parent.uuid,
        toh,
      });

      if (!imprint) {
        return null;
      }

      // Transform to GraphQL schema format
      return {
        toh: imprint.toh,
        section: imprint.section,
        version: imprint.version ?? null,
        restriction: imprint.restriction,
        publishYear: imprint.publishYear,
        tibetanAuthors: imprint.tibetanAuthors,
        isAuthorContested: imprint.isAuthorContested,
        sourceDescription: imprint.sourceDescription,
        publisherStatement: imprint.publisherStatement,
        tibetanTranslators: imprint.tibetanTranslators,
        license: {
          name: imprint.license.name ?? null,
          link: imprint.license.link ?? null,
          description: imprint.license.description ?? null,
        },
        mainTitles: imprint.mainTitles
          ? {
              tibetan: imprint.mainTitles.bo ?? null,
              english: imprint.mainTitles.en ?? null,
              wylie: imprint.mainTitles['Bo-Ltn'] ?? null,
              sanskrit: imprint.mainTitles['Sa-Ltn'] ?? null,
            }
          : null,
        longTitles: imprint.longTitles
          ? {
              tibetan: imprint.longTitles.bo ?? null,
              english: imprint.longTitles.en ?? null,
              wylie: imprint.longTitles['Bo-Ltn'] ?? null,
              sanskrit: imprint.longTitles['Sa-Ltn'] ?? null,
            }
          : null,
      };
    },

    passages: async (
      parent: WorkParent,
      args: { cursor?: string; limit?: number; filter?: { type?: string } },
      ctx: GraphQLContext,
    ) => {
      // Default and clamp limit
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

      // Map GraphQL filter type to database type
      const passageType = args.filter?.type
        ? PASSAGE_TYPE_MAP[args.filter.type]
        : undefined;

      const result = await getTranslationPassages({
        client: ctx.supabase,
        uuid: parent.uuid,
        type: passageType,
        cursor: args.cursor,
        maxPassages: limit,
        direction: 'forward' as PaginationDirection,
      });

      // Transform passages to GraphQL format
      const nodes = result.passages.map((passage) => ({
        uuid: passage.uuid,
        content: passage.content,
        label: passage.label,
        sort: passage.sort,
        type: PASSAGE_TYPE_TO_ENUM[passage.type] ?? 'UNKNOWN',
        xmlId: passage.xmlId ?? null,
        annotations: passage.annotations.map((annotation) => ({
          uuid: annotation.uuid,
          type: ANNOTATION_TYPE_TO_ENUM[annotation.type] ?? 'UNKNOWN',
          start: annotation.start,
          end: annotation.end,
          content: null, // Content is embedded in annotation-specific fields
        })),
      }));

      return {
        nodes,
        nextCursor: result.nextCursor ?? null,
        prevCursor: result.prevCursor ?? null,
        hasMoreAfter: result.hasMoreAfter,
        hasMoreBefore: result.hasMoreBefore,
      };
    },
  },
};
