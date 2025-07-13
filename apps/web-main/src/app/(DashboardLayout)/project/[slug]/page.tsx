import { ProjectPage } from '../../../../components/project/ProjectPage';
import React from 'react';

export const revalidate = 60;
export const dynamicParams = true;

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <ProjectPage uuid={slug} />
    </div>
  );
};

export default page;
