import { ReaderLeftPanelPage } from '@eightyfourthousand/lib-editing/ssr';

/**
 * Fallback for the `@left` slot when Next cannot match it to the current URL.
 *
 * Insurance rather than a fix: all three slots currently have a page at this
 * exact path, so Next never falls back and the build references this file zero
 * times. It matters the moment the slots stop matching in lockstep — a slot
 * with no default renders a 404 for the whole route rather than degrading, and
 * that failure is silent enough to read as a blank page. Rendering what the
 * page renders keeps the slot behaving the same however the route is entered.
 */
const Default = ReaderLeftPanelPage;

export default Default;
