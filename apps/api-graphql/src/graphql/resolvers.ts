import {
  getTranslationsMetadata,
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
  getTranslationImprint,
  type BodyItemType,
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

// Map database annotation types (kebab-case) to GraphQL enum values
const ANNOTATION_DTO_TYPE_TO_ENUM: Record<string, string> = {
  abbreviation: 'ABBREVIATION',
  audio: 'AUDIO',
  blockquote: 'BLOCKQUOTE',
  code: 'CODE',
  'deprecated-internal-link': 'DEPRECATED',
  'end-note-link': 'END_NOTE_LINK',
  'glossary-instance': 'GLOSSARY_INSTANCE',
  'has-abbreviation': 'HAS_ABBREVIATION',
  heading: 'HEADING',
  image: 'IMAGE',
  indent: 'INDENT',
  'inline-title': 'INLINE_TITLE',
  'internal-link': 'INTERNAL_LINK',
  'leading-space': 'LEADING_SPACE',
  line: 'LINE',
  'line-group': 'LINE_GROUP',
  link: 'LINK',
  list: 'LIST',
  'list-item': 'LIST_ITEM',
  mantra: 'MANTRA',
  paragraph: 'PARAGRAPH',
  quote: 'QUOTE',
  quoted: 'QUOTED',
  reference: 'REFERENCE',
  span: 'SPAN',
  table: 'TABLE',
  'table-body-data': 'TABLE_BODY_DATA',
  'table-body-header': 'TABLE_BODY_HEADER',
  'table-body-row': 'TABLE_BODY_ROW',
  trailer: 'TRAILER',
  unknown: 'UNKNOWN',
};

// Map database passage types (camelCase) to database format
const PASSAGE_TYPE_TO_DB: Record<string, string> = {
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
        ? PASSAGE_TYPE_TO_DB[args.filter.type]
        : undefined;

      // If cursor provided, get its sort value for pagination
      let cursorSort: number | null = null;
      if (args.cursor) {
        const { data: cursorPassage } = await ctx.supabase
          .from('passages')
          .select('sort')
          .eq('uuid', args.cursor)
          .single();

        if (cursorPassage) {
          cursorSort = cursorPassage.sort;
        }
      }

      // Build the passages query
      let query = ctx.supabase
        .from('passages')
        .select('uuid, content, label, sort, type, xmlId')
        .eq('work_uuid', parent.uuid)
        .order('sort', { ascending: true })
        .limit(limit + 1); // Fetch one extra to determine hasMoreAfter

      // Apply cursor filter
      if (cursorSort !== null) {
        query = query.gt('sort', cursorSort);
      }

      // Apply type filter
      if (passageType) {
        query = query.eq('type', passageType);
      }

      const { data: passages, error: passagesError } = await query;

      if (passagesError) {
        console.error('Error fetching passages:', passagesError);
        return {
          nodes: [],
          nextCursor: null,
          prevCursor: null,
          hasMoreAfter: false,
          hasMoreBefore: false,
        };
      }

      // Determine if there are more passages
      const hasMoreAfter = passages && passages.length > limit;
      const resultPassages = hasMoreAfter ? passages.slice(0, limit) : passages;

      // Determine if there are passages before (only if we have a cursor)
      const hasMoreBefore = cursorSort !== null;

      if (!resultPassages || resultPassages.length === 0) {
        return {
          nodes: [],
          nextCursor: null,
          prevCursor: args.cursor ?? null,
          hasMoreAfter: false,
          hasMoreBefore,
        };
      }

      // Load annotations for all passages using DataLoader (batched)
      const passageUuids = resultPassages.map((p) => p.uuid);
      const annotationsByPassage = await ctx.loaders.annotationsByPassageUuid.loadMany(passageUuids);

      // Transform passages to GraphQL format
      const nodes = resultPassages.map((passage, index) => {
        const passageAnnotations = annotationsByPassage[index];
        // Handle potential Error from loadMany
        const annotations = passageAnnotations instanceof Error ? [] : passageAnnotations;

        return {
          uuid: passage.uuid,
          content: passage.content,
          label: passage.label,
          sort: passage.sort,
          type: PASSAGE_TYPE_TO_ENUM[passage.type as BodyItemType] ?? 'UNKNOWN',
          xmlId: passage.xmlId ?? null,
          annotations: annotations.map((annotation) => ({
            uuid: annotation.uuid,
            type: ANNOTATION_DTO_TYPE_TO_ENUM[annotation.type] ?? 'UNKNOWN',
            start: annotation.start,
            end: annotation.end,
            content: annotation.content
              ? JSON.stringify(annotation.content)
              : null,
          })),
        };
      });

      // Compute cursors
      const lastPassage = resultPassages[resultPassages.length - 1];
      const nextCursor = hasMoreAfter ? lastPassage.uuid : null;

      return {
        nodes,
        nextCursor,
        prevCursor: args.cursor ?? null,
        hasMoreAfter,
        hasMoreBefore,
      };
    },
  },
};
