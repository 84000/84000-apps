'use client';
import Profile from './Profile';
import { Language } from './Language';
import { Navbar } from 'flowbite-react';

const MobileHeaderItems = () => {
  return (
    <Navbar
      fluid
      className="rounded-none bg-white dark:bg-darkgray flex-1 px-9 "
    >
      <div className="xl:hidden block w-full">
        <div className="flex gap-3 justify-center items-center">
          <Language />
          <Profile />
        </div>
      </div>
    </Navbar>
  );
};

export default MobileHeaderItems;
