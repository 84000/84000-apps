import { Suspense } from 'react';
import { OAuthConsent } from '@lib-user';

const OAuthAuthorizePage = () => {
  return (
    <div className="w-screen h-screen flex">
      <Suspense>
        <OAuthConsent />
      </Suspense>
    </div>
  );
};

export default OAuthAuthorizePage;
