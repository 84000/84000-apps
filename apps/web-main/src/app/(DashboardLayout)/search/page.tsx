import { H1, Skeleton } from '@design-system';

const Page = () => {
  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="xl:max-w-2/3 lg:max-w-3/4 sm:max-w-4/5 w-full">
        <H1 className="text-navy">Search is coming soon...</H1>
        <Skeleton className="w-full h-96" />
      </div>
    </div>
  );
};

export default Page;
