import {
  ReaderBodyPage,
  StackReaderBodyPage,
} from '@eightyfourthousand/lib-editing/ssr';

/**
 * The reader's main panel: paginated, or drawn as passage stacks when
 * `READER_RENDERER=stack`.
 */
export const MainPanelPage =
  process.env.READER_RENDERER === 'stack'
    ? StackReaderBodyPage
    : ReaderBodyPage;
