import { H1, Skeleton } from '@design-system';

const Page = () => {
  return (
    <div className="flex flex-col justify-center gap-8">
      <H1>Glossary</H1>
      <div className="size-full pe-6">
        <Skeleton className="w-full h-96" />
      </div>
    </div>
  );
};

export default Page;
