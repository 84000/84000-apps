'use client';

import React from 'react';
import { RightPart } from './RightPart';
import { SocialLogin } from './SocialLogin';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Side Login Authentication',
  description: 'Generated by create next app',
};

export const Login: React.FC<{ loginWithGoogle: () => void }> = ({
  loginWithGoogle,
}) => {
  return (
    <>
      <div className="relative overflow-hidden h-screen">
        <div className="grid grid-cols-12 gap-3 h-screen bg-white dark:bg-darkgray">
          <div className="xl:col-span-4 lg:col-span-6 col-span-12 sm:px-12 px-4">
            <div className="flex h-screen items-center px-3 lg:justify-start justify-center">
              <div className="max-w-md w-full mx-auto">
                <h3 className="text-2xl font-bold my-3 mt-5">
                  Sign In to Continue
                </h3>
                <SocialLogin loginWithGoogle={loginWithGoogle} />
                <div className="h-40" />
              </div>
            </div>
          </div>
          <div className="xl:col-span-8 lg:col-span-6 col-span-12 bg-[#0A2540] dark:bg-dark lg:block hidden relative overflow-hidden">
            <RightPart />
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
