'use client';

import { useSession } from './SessionContext';
import { cn } from '@lib-utils';
import { AppleLogo, GoogleLogo } from '@design-system';

const IS_APPLE_ENABLED = false;

export const SocialLogin = ({ className }: { className?: string }) => {
  const { loginWithApple, loginWithGoogle } = useSession();

  return (
    <div
      className={cn('flex flex-col justify-between gap-2 mt-6 mb-4', className)}
    >
      <div
        onClick={loginWithGoogle}
        className="px-4 py-2 border-border border flex gap-3 items-enter w-full rounded-full text-center text-sm justify-center cursor-pointer"
      >
        <GoogleLogo />
        <span>Sign in with Google</span>
      </div>
      {IS_APPLE_ENABLED && (
        <div
          onClick={loginWithApple}
          className="px-4 py-2 border-border border flex gap-3 items-enter w-full rounded-full text-center text-sm justify-center cursor-pointer"
        >
          <AppleLogo />
          <span>Sign in with Apple</span>
        </div>
      )}
    </div>
  );
};
