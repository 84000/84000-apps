import { cn } from '@lib-utils';
import { Login } from '@lib-user';

const LoginPage = () => {
  const bgImage = 'md:bg-[url(/images/backgrounds/bg-main.webp)]';
  const rightBgImage = 'bg-[url(/images/backgrounds/bg-login.webp)]';

  return (
    <div className={cn(bgImage, 'w-screen h-screen bg-cover bg-top')}>
      <div className="m-auto w-full h-screen 3xl:p-16 max-w-screen-3xl">
        <div className="grid md:grid-cols-2 w-full h-full 3xl:bg-background 3xl:rounded-lg 3xl:shadow-md overflow-hidden">
          <div className="w-full">
            <Login />
          </div>
          <div
            className={cn(rightBgImage, 'bg-cover bg-center md:flex hidden')}
          >
            <div className="h-full w-full bg-radial from-transparent to-black/50 to-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
