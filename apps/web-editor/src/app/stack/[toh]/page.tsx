import { StackPage } from '../../../components/StackPage';

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ toh: string }>;
  searchParams: Promise<{ repeat?: string }>;
}) => {
  const { toh } = await params;
  const { repeat } = await searchParams;
  return <StackPage toh={toh} repeat={Number(repeat) || 1} />;
};

export default Page;
