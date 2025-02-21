'use client';

import SocialLogin from '../../../components/ui/SocialLogin';
import { useSession } from '../../context/SessionContext';
import CardBox from '../../components/shared/CardBox';
import { MainLogo } from '@design-system';

export const LoginPage = () => {
  const { loginWithGoogle } = useSession();
  return (
    <>
      <div className="relative min-h-screen flex flex-col justify-center bg-cover bg-center bg-primary">
        <div className="flex h-full justify-center items-center px-4">
          <CardBox className="sm:max-w-sm w-full border-none p-0">
            <div className="py-8 px-6">
              <div className="flex justify-center items-center py-8">
                <MainLogo />
              </div>
              <h3 className="text-2xl font-bold my-3 mt-5">
                Sign In to Continue
              </h3>
              <SocialLogin loginWithGoogle={loginWithGoogle} />
              <div className="h-8" />
            </div>
          </CardBox>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
