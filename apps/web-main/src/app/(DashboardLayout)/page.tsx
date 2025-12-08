import { H1, H5 } from '@design-system';
import React from 'react';

const page = () => {
  return (
    <div className="flex flex-row justify-center p-4 size-full bg-surface">
      <div className="xl:max-w-2/3 lg:max-w-3/4 sm:max-w-4/5 w-full text-center">
        <H1 className="text-navy max-w-2xl mx-auto">
          {"Welcome to 84000's Scholar's Room"}
        </H1>
        <H5 className="text-muted-foreground">
          This is your dedicated space for research and study of the Tibetan
          canon.
        </H5>
      </div>
    </div>
  );
};

export default page;
