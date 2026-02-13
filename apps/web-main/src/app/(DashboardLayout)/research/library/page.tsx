import { notFound } from 'next/navigation';

const Page = () => {
  const url = process.env.NEXT_PUBLIC_RESEARCH_LIBRARY_URL;
  if (!url) {
    return notFound();
  }

  return (
    <iframe
      src={url}
      className="size-full bg-background"
      title="84000 Research Library"
    />
  );
};

export default Page;
