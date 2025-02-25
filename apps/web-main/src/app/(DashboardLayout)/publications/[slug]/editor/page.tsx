import { Card, CardContent, CardTitle } from '@design-system';
import React from 'react';

const page = () => {
  return (
    <>
      <Card>
        <CardTitle>Translation Editor</CardTitle>
        <CardContent>
          <p>
            {`Lorem Ipsum is simply dummy text of the printing and typesetting
          industry. Lorem Ipsum has been the industry's standard dummy text ever
          since the 1500s`}
          </p>
        </CardContent>
      </Card>
    </>
  );
};

export default page;
