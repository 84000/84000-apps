"use client";
import Link from "next/link";
import React from "react";
import Google from "/public/images/svgs/google-icon.svg";
import FB from "/public/images/svgs/facebook-icon.svg";
import Image from "next/image";
import { HR } from "flowbite-react";

interface MyAppProps {
    title?:string;
  }

const BoxedSocialButtons: React.FC<MyAppProps> = ({ title }) => {
  return (
    <>
      <div className="flex justify-between gap-8 mb-6 md:mt-10 mt-5">
        
        <Link
          href={"/"}
          className="px-4 py-3 shadow-tw border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld hover:bg-sky hover:text-white dark:text-white dark:hover:bg-sky font-semibold"
        >
          <Image src={FB} alt="google" height={18} width={18} />
         <span className="lg:flex hidden">Sign in with</span>Facebook
        </Link>
        <Link
          href={"/"}
          className="px-4 py-3 shadow-tw border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld hover:bg-sky hover:text-white dark:text-white dark:hover:bg-sky font-semibold"
        >
          <Image src={Google} alt="google" height={18} width={18} /> <span className="lg:flex hidden">Sign in with</span>Google
        </Link>
      </div>
      {/* Divider */}
      <HR.Text text={`${title}`} className="!border-t !border-ld !bg-transparent text-bodytext" />
    </>
  );
};

export default BoxedSocialButtons;
