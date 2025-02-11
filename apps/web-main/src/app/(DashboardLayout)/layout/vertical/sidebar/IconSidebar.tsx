"use-client";
import React, { useState, useEffect, useContext } from "react";
import { Icon } from "@iconify/react";
import Miniicons from "./MiniSidebar";
import SimpleBar from "simplebar-react";
import { CustomizerContext } from "@/app/context/CustomizerContext";
import Link from "next/link";
import { Button, HR, Tooltip } from "flowbite-react";

export const IconSidebar = () => {
  const { selectedIconId, setSelectedIconId, setIsCollapse, isCollapse } =
    useContext(CustomizerContext) || {};

  // Handle icon click
  const handleClick = (id: any) => {
    setSelectedIconId(id);
    setIsCollapse("full-sidebar");
  };

  return (
    <>
      <div className="minisidebar-icon dark:bg-dark">
        <div className="barnd-logo">
          <Link
            href="#"
            className="nav-link"
            onClick={() => {
              if (isCollapse === "full-sidebar") {
                setIsCollapse("mini-sidebar");
              } else {
                setIsCollapse("full-sidebar");
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
          {Miniicons.map((links, index) => (
            <Tooltip
              key={links.id}
              content={links.tooltip}
              placement="right"
              className="flowbite-tooltip"
            >
              <Button
                key={index}
                className={`h-12 w-12 hover:text-primary text-darklink dark:text-white/70 hover:bg-lightprimary rounded-tw flex justify-center items-center mx-auto mb-2 ${
                  links.id === selectedIconId
                    ? "text-white bg-primary hover:text-white dark:hover:text-white"
                    : "text-darklink  bg-transparent"
                }`}
                type="button"
                onClick={() => handleClick(links.id)}
              >
                <Icon icon={links.icon} height={24} className="dark:bg-blue " />
              </Button>

              {index > 0 &&
                (index + 1) % 3 === 0 &&
                index + 1 !== Miniicons.length && <HR className="my-3"></HR>}
            </Tooltip>
          ))}
        </SimpleBar>
      </div>
    </>
  );
};
