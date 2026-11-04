import { ReaderLayout } from '@eightyfourthousand/lib-editing';
import {
  ReaderBackMatterPage,
  ReaderBodyPage,
  StackReaderBackMatterPage,
  StackReaderBodyPage,
  StackReaderLayout,
} from '@eightyfourthousand/lib-editing/ssr';

/**
 * The reader is paginated, or drawn as passage stacks when
 * `READER_RENDERER=stack`: the layout holds the stacks, and the main and right
 * panels draw from them. The left panel is the same either way.
 */
const stack = process.env.READER_RENDERER === 'stack';

export const Layout = stack ? StackReaderLayout : ReaderLayout;

export const MainPanelPage = stack ? StackReaderBodyPage : ReaderBodyPage;

export const RightPanelPage = stack
  ? StackReaderBackMatterPage
  : ReaderBackMatterPage;
