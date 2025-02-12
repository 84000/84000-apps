'use client';
import React, { useState, useEffect, useContext } from 'react';
import { Navbar } from 'flowbite-react';
import { Icon } from '@iconify/react';
import Profile from './Profile';
import { CustomizerContext } from '../../../../context/CustomizerContext';
import { Language } from './Language';
import MobileHeaderItems from './MobileHeaderItems';
import { Drawer } from 'flowbite-react';
import MobileSidebar from '../sidebar/MobileSidebar';
import HorizontalMenu from '../../horizontal/header/HorizontalMenu';
import { MainLogo } from '@design-system';

interface HeaderPropsType {
  layoutType: string;
}

const Header = ({ layoutType }: HeaderPropsType) => {
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

  const { isLayout } = useContext(CustomizerContext);

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
          className={`rounded-none bg-transparent dark:bg-transparent py-4 sm:px-[15px] px-2 ${
            layoutType == 'horizontal' ? 'container mx-auto !px-6' : ''
          }  ${isLayout == 'full' ? '!max-w-full ' : ''}`}
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
              {layoutType == 'horizontal' ? (
                <div className="me-3">
                  <MainLogo />
                </div>
              ) : null}
            </div>
          </Navbar.Collapse>

          {/* mobile-logo */}
          <div className="block xl:hidden">
            <MainLogo />
          </div>

          <Navbar.Collapse className="xl:block hidden">
            <div className="flex gap-3 items-center">
              <Language />
              <Profile />
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
          <MobileHeaderItems />
        </div>

        {/* Horizontal Menu  */}
        {layoutType == 'horizontal' ? (
          <div className="xl:border-t xl:border-ld">
            <div
              className={`${isLayout == 'full' ? 'w-full px-6' : 'container'}`}
            >
              <HorizontalMenu />
            </div>
          </div>
        ) : null}
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
