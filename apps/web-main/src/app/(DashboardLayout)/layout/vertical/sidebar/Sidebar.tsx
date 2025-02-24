'use client';
import React from 'react';
import { Sidebar } from 'flowbite-react';
import SidebarContent from './Sidebaritems';
import NavItems from './NavItems';
import NavCollapse from './NavCollapse';
import SimpleBar from 'simplebar-react';
import { Icon } from '@iconify/react';
import { MiniLogo } from '@design-system';

const SidebarLayout = () => {
  return (
    <>
      <div className="xl:block hidden">
        <div className="flex">
          <Sidebar
            className="fixed menu-sidebar  bg-white dark:bg-darkgray rtl:pe-4"
            aria-label="Sidebar with multi-level dropdown example"
          >
            <div className="px-4 py-4 brand-logo">
              <MiniLogo width={50} height={50} />
            </div>
            <SimpleBar className="h-[calc(100vh_-_85px)]">
              <Sidebar.Items className="rtl:pe-0 rtl:ps-3 px-4 mt-2">
                <Sidebar.ItemGroup className="sidebar-nav">
                  {SidebarContent.map((item, index) => (
                    <React.Fragment key={index}>
                      <h5 className="text-link dark:text-white/70 caption font-semibold leading-6 tracking-widest text-sm  pb-2 uppercase ">
                        <span className="hide-menu">{item.heading}</span>
                      </h5>
                      <Icon
                        icon="solar:menu-dots-bold"
                        className="text-ld block mx-auto mt-6 leading-6 dark:text-opacity-60 hide-icon"
                        height={18}
                      />

                      {item.children?.map((child, index) => (
                        <React.Fragment key={child.id && index}>
                          {child.children ? (
                            <div className="collpase-items">
                              <NavCollapse item={child} />
                            </div>
                          ) : (
                            <NavItems item={child} />
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </Sidebar.ItemGroup>
              </Sidebar.Items>
            </SimpleBar>
          </Sidebar>
        </div>
      </div>
    </>
  );
};

export default SidebarLayout;
