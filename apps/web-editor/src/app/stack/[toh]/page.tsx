import { StackPage } from '../../../components/StackPage';

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ toh: string }>;
  searchParams: Promise<{
    repeat?: string;
    overscan?: string;
    readonly?: string;
    unbounded?: string;
  }>;
}) => {
  const { toh } = await params;
  const { repeat, overscan, readonly, unbounded } = await searchParams;
  return (
    <StackPage
      toh={toh}
      repeat={Number(repeat) || 1}
      overscan={Number(overscan) || undefined}
      readOnly={readonly !== undefined && readonly !== 'false'}
      unbounded={unbounded !== undefined && unbounded !== 'false'}
    />
  );
};

export default Page;
