'use-client';
import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import SimpleBar from 'simplebar-react';
import Link from 'next/link';
import { Button, HR, Tooltip } from 'flowbite-react';

export type CollapseState = 'full-sidebar' | 'mini-sidebar';

export interface MiniIcon {
  id: number;
  icon: string;
  tooltip: string;
}

export const IconSidebar = ({ icons }: { icons: MiniIcon[] }) => {
  const [isCollapse, setIsCollapse] = useState<CollapseState>('full-sidebar');
  const [selectedIconId, setSelectedIconId] = useState<number>(1);

  // Handle icon click
  const handleClick = (id: number) => {
    setSelectedIconId(id);
    setIsCollapse('full-sidebar');
  };

  return (
    <div className="minisidebar-icon dark:bg-dark">
      <div className="barnd-logo">
        <Link
          href="#"
          className="nav-link"
          onClick={() => {
            if (isCollapse === 'full-sidebar') {
              setIsCollapse('mini-sidebar');
            } else {
              setIsCollapse('full-sidebar');
            }
          }}
        >
          <Icon
            icon="solar:hamburger-menu-line-duotone"
            height={24}
            className="text-black dark:text-white dark:hover:text-primary"
          />
        </Link>
      </div>
      <SimpleBar className="miniicons ">
        {icons.map((links, index) => (
          <Button
            key={index}
            className={`h-12 w-12 hover:text-primary text-darklink dark:text-white/70 hover:bg-lightprimary rounded-tw flex justify-center items-center mx-auto mb-2 ${
              links.id === selectedIconId
                ? 'text-white bg-primary hover:text-white dark:hover:text-white'
                : 'text-darklink  bg-transparent'
            }`}
            type="button"
            onClick={() => handleClick(links.id)}
          >
            <Icon icon={links.icon} height={24} className="dark:bg-blue " />
          </Button>
        ))}
      </SimpleBar>
    </div>
  );
};
