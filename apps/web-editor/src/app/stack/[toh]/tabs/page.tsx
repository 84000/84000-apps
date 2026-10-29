import { StackTabsPage } from '../../../../components/StackTabsPage';

const Page = async ({
  params,
  searchParams,
}: {
  params: Promise<{ toh: string }>;
  searchParams: Promise<{ readonly?: string }>;
}) => {
  const { toh } = await params;
  const { readonly } = await searchParams;
  return (
    <StackTabsPage
      toh={toh}
      readOnly={readonly !== undefined && readonly !== 'false'}
    />
  );
};

export default Page;
