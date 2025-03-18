'use client';

import SocialLogin from '../../../components/ui/SocialLogin';
import { useSession } from '../../context/SessionContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H3,
  MainLogo,
} from '@design-system';

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
            <CardHeader className="flex justify-center items-center pt-12">
              <MainLogo />
            </CardHeader>
            <CardContent className="pb-8">
              <CardTitle>
                <H3>Sign In to Continue</H3>
              </CardTitle>
              <SocialLogin loginWithGoogle={loginWithGoogle} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
