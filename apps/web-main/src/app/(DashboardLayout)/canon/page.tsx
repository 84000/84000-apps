import { PageLoading } from '@lib-canon';

// Redirect to the root of the Kangyur
const DEFAULT_CANON_UUID = '1ccb08cb-4ddc-4f48-bdb0-df436eadeec3';

const page = async () => {
  return <PageLoading redirectTo={`/canon/${DEFAULT_CANON_UUID}`} />;
};

export default page;
