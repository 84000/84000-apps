import { StackPage } from '../../../components/StackPage';

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ toh: string }>;
  searchParams: Promise<{ repeat?: string; overscan?: string }>;
}) => {
  const { toh } = await params;
  const { repeat, overscan } = await searchParams;
  return (
    <StackPage
      toh={toh}
      repeat={Number(repeat) || 1}
      overscan={Number(overscan) || undefined}
    />
  );
};

export default Page;
