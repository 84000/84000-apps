"use client";
import { Button, Label, TextInput } from "flowbite-react";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
const AuthTwoSteps = () => {
  const pathname = usePathname();
  return (
    <>
      <form className="mt-6">
        <div className="mb-4">
          <div className="mb-2 block">
            <Label value="Type your 6 digits security code" />
          </div>
          <div className="flex gap-3.5">
            <TextInput
              type="text"
              sizing="md"
              className="form-control input-center"
            />
            <TextInput
              type="text"
              sizing="md"
              className="form-control input-center"
            />
            <TextInput
              type="text"
              sizing="md"
              className="form-control input-center"
            />
            <TextInput
              type="text"
              sizing="md"
              className="form-control input-center"
            />
            <TextInput
              type="text"
              sizing="md"
              className="form-control input-center"
            />
            <TextInput
              type="text"
              sizing="md"
              className="form-control input-center"
            />
          </div>
        </div>
        {pathname == "/auth/auth2/two-steps" ? (
          <Button className="rounded-md w-full bg-sky dark:bg-sky  hover:bg-dark dark:hover:bg-dark">
            Verify My Account
          </Button>
        ) : (
          <Button color={"primary"} className="w-full">
            Verify My Account
          </Button>
        )}
      </form>
    </>
  );
};

export default AuthTwoSteps;
