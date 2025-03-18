import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H2,
  P,
} from '@design-system';
import React from 'react';

const page = () => {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <H2>{"Scholar's Room Dashboard"}</H2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <P>
            {`Lorem Ipsum is simply dummy text of the printing and typesetting
          industry. Lorem Ipsum has been the industry's standard dummy text ever
          since the 1500s`}
          </P>
        </CardContent>
      </Card>
    </>
  );
};

export default page;
