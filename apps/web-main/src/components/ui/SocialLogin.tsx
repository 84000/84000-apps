'use client';
import React from 'react';
import Image from 'next/image';

export const SocialLogin: React.FC<{
  loginWithGoogle: () => void;
}> = ({ loginWithGoogle }) => {
  return (
    <>
      <div className="flex justify-between gap-8 my-6 ">
        <div
          onClick={loginWithGoogle}
          className="px-4 py-2.5 border-border border dark:border-darkborder flex gap-2 items-enter w-full rounded-md text-center justify-center text-dark dark:text-white text-primary-ld cursor-pointer"
        >
          <Image
            src={'/images/svgs/google-icon.svg'}
            alt="google"
            height={18}
            width={18}
          />{' '}
          Google
        </div>
      </div>
    </>
  );
};

export default SocialLogin;
