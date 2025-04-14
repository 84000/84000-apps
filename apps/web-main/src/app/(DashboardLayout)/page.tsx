import { H2, P } from '@design-system';
import React from 'react';

const page = () => {
  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="xl:max-w-2/3 lg:max-w-3/4 sm:max-w-4/5 w-full">
        <H2>{"Scholar's Room Dashboard"}</H2>
        <P>
          {`Lorem Ipsum is simply dummy text of the printing and typesetting
          industry. Lorem Ipsum has been the industry's standard dummy text ever
          since the 1500s`}
        </P>
      </div>
    </div>
  );
};

export default page;
