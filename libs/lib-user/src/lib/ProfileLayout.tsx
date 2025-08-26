'use client';

import { Button, H2, Label, ScrollArea } from '@design-system';
import { ReactNode } from 'react';
import {
  LIBRARY_ITEMS,
  ProfileProvider,
  useProfileContext,
} from './ProfileProvider';

const InnerProfileLayout = ({ children }: { children: ReactNode }) => {
  const { activeMenu, onMenuChange } = useProfileContext();

  return (
    <div className="flex flex-col pt-0 pb-8 md:px-8 px-4 w-full">
      <H2 className="text-navy-500 capitalize">
        {activeMenu === 'profile' ? 'My Profile' : activeMenu}
      </H2>
      <div className="flex flex-row gap-10">
        <div className="rounded-lg shadow-sm bg-sidebar-background w-[20rem] hidden md:flex">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-2 py-4 px-2">
              <Button
                variant={activeMenu === 'profile' ? 'active' : 'ghost'}
                className="px-2 justify-start"
                onClick={() => onMenuChange('profile')}
              >
                My Profile
              </Button>
              <Label className="p-2 font-semibold">My Library</Label>
              <div className="flex flex-col gap-2">
                {LIBRARY_ITEMS.map((menu) => (
                  <Button
                    key={menu}
                    variant={activeMenu === menu ? 'active' : 'ghost'}
                    className="px-5 justify-start"
                    onClick={() => onMenuChange(menu)}
                  >
                    {menu.charAt(0).toUpperCase() + menu.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <ScrollArea className="w-full">{children}</ScrollArea>
      </div>
    </div>
  );
};

export const ProfileLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ProfileProvider>
      <InnerProfileLayout>{children}</InnerProfileLayout>
    </ProfileProvider>
  );
};
