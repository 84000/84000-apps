import { ReaderLeftPanelPage } from '@eightyfourthousand/lib-editing/ssr';

// Rendered on demand rather than prerendered at build: this app is for local
// testing, and a build should not fetch every work.
export const revalidate = 60;

const Page = ReaderLeftPanelPage;

export default Page;
