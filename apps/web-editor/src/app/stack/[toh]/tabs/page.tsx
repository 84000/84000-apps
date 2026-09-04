import { StackTabsPage } from '../../../../components/StackTabsPage';

const Page = async ({ params }: { params: Promise<{ toh: string }> }) => {
  const { toh } = await params;
  return <StackTabsPage toh={toh} />;
};

export default Page;
