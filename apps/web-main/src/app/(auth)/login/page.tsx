'use client';

import SocialLogin from '../../../components/ui/SocialLogin';
import { useSession } from '../../context/SessionContext';
import { Card, CardTitle, MainLogo } from '@design-system';

const LoginPage = () => {
  const { loginWithGoogle } = useSession();

  const bgImage =
    'bg-[url(https://cdn.prod.website-files.com/661fb69072916f350216ad91/66bd96d7b11732fc3ba19751_Donate-p-2000.jpeg)]';
  return (
    <>
      <div
        className={`relative min-h-screen flex flex-col justify-center bg-cover bg-center ${bgImage}`}
      >
        <div className="flex h-full justify-center items-center sm:pr-[50%] px-4">
          <Card className="sm:max-w-sm w-full">
            <div className="flex justify-center items-center py-8">
              <MainLogo />
            </div>
            <CardTitle className="text-2xl">Sign In to Continue</CardTitle>
            <SocialLogin loginWithGoogle={loginWithGoogle} />
            <div className="h-8" />
          </Card>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
