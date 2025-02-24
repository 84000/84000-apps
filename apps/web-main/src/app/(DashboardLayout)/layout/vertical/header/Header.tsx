'use client';
import React, { useState, useEffect } from 'react';
import { Navbar } from 'flowbite-react';
import { Icon } from '@iconify/react';
import Profile from './Profile';
import { useUIState } from '../../../../context/InterfaceContext';
import { Language } from './Language';
import MobileHeaderItems from './MobileHeaderItems';
import { Drawer } from 'flowbite-react';
import MobileSidebar from '../sidebar/MobileSidebar';
import { MainLogo } from '@design-system';
import { ScholarUser } from '../../../../context/SessionContext';

interface HeaderPropsType {
  user: ScholarUser;
  handleLogout: () => void;
}

const Header = ({ user, handleLogout }: HeaderPropsType) => {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const { isCollapse, setIsCollapse } = useUIState();

  const [mobileMenu, setMobileMenu] = useState('');

  const handleMobileMenu = () => {
    if (mobileMenu === 'active') {
      setMobileMenu('');
    } else {
      setMobileMenu('active');
    }
  };

  // mobile-sidebar
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => setIsOpen(false);
  return (
    <>
      <header
        className={`top-0 z-[5]  ${
          isSticky ? 'bg-white dark:bg-darkgray sticky' : 'bg-transparent'
        }`}
      >
        <Navbar
          fluid
          className={
            'rounded-none bg-transparent dark:bg-transparent py-4 sm:px-[15px] px-2'
          }
        >
          {/* Mobile Toggle Icon */}
          <span
            onClick={() => setIsOpen(true)}
            className="h-10 w-10 flex text-black dark:text-white text-opacity-65 xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer"
          >
            <Icon icon="solar:hamburger-menu-line-duotone" height={21} />
          </span>
          {/* Toggle Icon   */}
          <Navbar.Collapse className="xl:block ">
            <div className="flex gap-3 items-center relative">
              <span
                onClick={() => {
                  if (isCollapse === 'full-sidebar') {
                    setIsCollapse('mini-sidebar');
                  } else {
                    setIsCollapse('full-sidebar');
                  }
                }}
                className="h-10 w-10 hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer text-darklink  dark:text-white"
              >
                <Icon icon="solar:hamburger-menu-line-duotone" height={21} />
              </span>
            </div>
          </Navbar.Collapse>

          {/* mobile-logo */}
          <div className="block xl:hidden">
            <MainLogo width={80} height={40} />
          </div>

          <Navbar.Collapse className="xl:block hidden">
            <div className="flex gap-3 items-center">
              <Language />
              <Profile user={user} handleLogout={handleLogout} />
            </div>
          </Navbar.Collapse>
          {/* Mobile Toggle Icon */}
          <span
            className="h-10 w-10 flex xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer"
            onClick={handleMobileMenu}
          >
            <Icon icon="tabler:dots" height={21} />
          </span>
        </Navbar>
        <div
          className={`w-full  xl:hidden block mobile-header-menu ${mobileMenu}`}
        >
          <MobileHeaderItems user={user} handleLogout={handleLogout} />
        </div>
      </header>

      {/* Mobile Sidebar */}
      <Drawer open={isOpen} onClose={handleClose} className="w-130">
        <Drawer.Items>
          <MobileSidebar />
        </Drawer.Items>
      </Drawer>
    </>
  );
};

export default Header;
