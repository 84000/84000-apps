import { MainPanelPage } from '../../../../main-panel';

// Rendered on demand rather than prerendered at build: this app is for local
// testing, and a build should not fetch every work.
export const revalidate = 60;

const Page = MainPanelPage;

export default Page;
