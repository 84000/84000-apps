'use client'
import { Sidebar } from "flowbite-react";
import React, { useEffect, useState } from "react";
import { ChildItem } from "../Sidebaritems";
import NavItems from "../NavItems";
import { Icon } from "@iconify/react";
import { HiOutlineChevronDown } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePathname } from "next/navigation";
import { useTranslation } from 'react-i18next';

interface NavCollapseProps {
  item: ChildItem;
}

const NavCollapse: React.FC<NavCollapseProps> = ({ item }: any) => {
  const pathname = usePathname();
  const activeDD = item.children.find((t: { url: string; }) => t.url === pathname);
  const { t, i18n } = useTranslation();
  const [translatedLabel, setTranslatedLabel] = useState<string | null>(null);

  useEffect(() => {
    const loadTranslation = async () => {

      const label = t(`${item.name}`);
      setTranslatedLabel(label);
    };
    loadTranslation();
  }, [i18n.language, item.name, t]);

  return (
    <>
      <Sidebar.Collapse
        label={translatedLabel || `${item.name}`}
        open={activeDD ? true : false}
        icon={() => <Icon icon={item.icon} height={18} />}

        className={activeDD ? '!text-white bg-primary rounded-xl hover:bg-primary hover:text-white shadow-btnshdw' : ' rounded-xl dark:text-white/80 hover:text-primary'}

        renderChevronIcon={(theme, open) => {
          const IconComponent = open
            ? HiOutlineChevronDown
            : HiOutlineChevronDown;
          return (
            <IconComponent
              aria-hidden
              className={twMerge(theme.label.icon.open[open ? "on" : "off"])}
            />
          );
        }}
      >
        {/* Render child items */}
        {item.children && (
          <Sidebar.ItemGroup className="sidebar-dropdown">
            {item.children.map((child: any) => (
              <React.Fragment key={child.id}>
                {/* Render NavItems for child items */}
                {child.children ? (
                  <NavCollapse item={child} /> // Recursive call for nested collapse
                ) : (
                  <NavItems item={child} />
                )}
              </React.Fragment>
            ))}
          </Sidebar.ItemGroup>
        )}
      </Sidebar.Collapse>
    </>
  );
};
export default NavCollapse;







