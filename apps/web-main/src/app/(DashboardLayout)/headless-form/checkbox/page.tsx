import type { Metadata } from "next";
import React from "react";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import WithLable from "../../../components/headless-form/Checkbox/WithLable";
import WithDescription from "../../../components/headless-form/Checkbox/WithDescription";
import DisableCheckBox from "../../../components/headless-form/Checkbox/DisableCheckBox";
import UsingHtmlForm from "../../../components/headless-form/Checkbox/UsingHtmlForm";
import UsingUncontrolled from "../../../components/headless-form/Checkbox/UsingUnctrolled";
import TransitionCheckbox from "../../../components/headless-form/Checkbox/TransitionCheckbox";
import RenderAsDiv from "../../../components/headless-form/Checkbox/RenderAsDiv";
import RenderAsProps from "../../../components/headless-form/Checkbox/RenderAsProps";

export const metadata: Metadata = {
  title: "Headless Form Checkbox",
};
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Checkbox",
  },
];

const page = () => {
  return (
    <div>
      <BreadcrumbComp title="Checkbox" items={BCrumb} />
      <div className="grid grid-cols-12 gap-30">
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <WithLable />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <WithDescription />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <DisableCheckBox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <UsingHtmlForm />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <UsingUncontrolled />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <TransitionCheckbox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <RenderAsDiv />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <RenderAsProps />
        </div>
      </div>
    </div>
  );
};

export default page;
