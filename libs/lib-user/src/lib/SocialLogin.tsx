'use client';

import Image from 'next/image';
import { useSession } from './SessionContext';
import { cn } from '@lib-utils';

const IS_APPLE_ENABLED = false;

export const SocialLogin = ({ className }: { className?: string }) => {
  const { loginWithApple, loginWithGoogle } = useSession();

  return (
    <div
      className={cn('flex flex-col justify-between gap-2 mt-6 mb-4', className)}
    >
      <div
        onClick={loginWithGoogle}
        className="px-4 py-2 border-border border flex gap-2 items-enter w-full rounded-full text-center text-sm justify-center cursor-pointer"
      >
        <Image
          src={'/images/svgs/google-icon.svg'}
          alt="google"
          height={16}
          width={16}
        />{' '}
        Sign in with Google
      </div>
      {IS_APPLE_ENABLED && (
        <div
          onClick={loginWithApple}
          className="px-4 py-2 border-border border flex gap-2 items-enter w-full rounded-full text-center text-sm justify-center cursor-pointer"
        >
          <Image
            src={'/images/svgs/apple-icon.svg'}
            alt="google"
            height={16}
            width={16}
          />{' '}
          Sign in with Apple
        </div>
      )}
    </div>
  );
};
