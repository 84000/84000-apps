import { Card, CardContent, CardHeader, CardTitle, H2 } from '@design-system';
import React from 'react';

const page = () => {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <H2>{'Project Management'}</H2>
          </CardTitle>
        </CardHeader>
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
