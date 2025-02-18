'use client';
import { MainLogo } from '@design-system';
import React from 'react';

export const RightPart = () => {
  return (
    <>
      <div className="circle-top"></div>
      <div className="flex xl:justify-start justify-center xl:ps-80 h-screen items-center z-10 relative">
        <div className="max-w-md">
          <div className="py-8">
            <MainLogo />
          </div>
          <h2 className="text-white text-[40px] font-bold leading-[normal]">
            Welcome to
            <br></br>
            The Scholar&apos;s Room
          </h2>
          <p className="opacity-75 text-white my-4 text-base font-medium">
            A place to do scholarly things.
          </p>
        </div>
      </div>
    </>
  );
};

export default RightPart;
