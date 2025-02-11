"use client";
import { Button, Label, TextInput } from "flowbite-react";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";

const AuthForgotPassword = () => {
  const pathname = usePathname();
  return (
    <>
      <form className="mt-6">
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="emadd" value="Email Address" />
          </div>
          <TextInput
            id="emadd"
            type="text"
            sizing="md"
            className="form-control"
          />
        </div>
        {pathname == "/auth/auth2/forgot-password" ? (
          <Button className="rounded-md w-full bg-sky dark:bg-sky  hover:bg-dark dark:hover:bg-dark">
            Forgot Password
          </Button>
        ) : (
          <Button color={"primary"} className="rounded-md w-full">
            Forgot Password
          </Button>
        )}
      </form>
    </>
  );
};

export default AuthForgotPassword;
