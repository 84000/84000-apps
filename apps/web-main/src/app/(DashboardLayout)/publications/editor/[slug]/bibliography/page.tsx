import { H1, Skeleton } from '@design-system';

const Page = () => {
  return (
    <div className="flex flex-col justify-center gap-8">
      <H1>Bibliography</H1>
      <Skeleton className="w-full h-150" />
    </div>
  );
};

export default Page;
