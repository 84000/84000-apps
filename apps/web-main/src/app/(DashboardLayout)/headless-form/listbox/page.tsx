import type { Metadata } from "next";
import React from "react";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import BasicListbox from "../../../components/headless-form/Listbox/BasicListbox";
import LabelListbox from "../../../components/headless-form/Listbox/LabelListbox";
import DisableListBox from "../../../components/headless-form/Listbox/DisableListbox";
import DisableListAll from "../../../components/headless-form/Listbox/DisableListBoxAll";
import ListboxWithDescription from "../../../components/headless-form/Listbox/ListboxWithDescription";
import ListBoxWithHtmlForm from "../../../components/headless-form/Listbox/ListBoxWithHtmlForm";
import ListBoxWidth from "../../../components/headless-form/Listbox/ListboxWidth";
import HorizontalListBox from "../../../components/headless-form/Listbox/HorizontalListBox";
import TransitionListBox from "../../../components/headless-form/Listbox/ListboxTransition";
import ListboxFramerMotion from "../../../components/headless-form/Listbox/ListboxFramerMotion";
import ListboxWithMultipleVal from "../../../components/headless-form/Listbox/ListboxWithMultipleVal";
import RenderingAsDiffElemtns from "../../../components/headless-form/Listbox/RenderingAsDiffElemtns";

export const metadata: Metadata = {
  title: "Headless Form Listbox",
};
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Listbox",
  },
];
const page = () => {
  return (
    <>
      <BreadcrumbComp title="Listbox" items={BCrumb} />
      <div className="grid grid-cols-12 gap-30">
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <BasicListbox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <LabelListbox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <DisableListAll />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <DisableListBox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <ListboxWithDescription />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <ListBoxWithHtmlForm />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <ListBoxWidth />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <HorizontalListBox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <TransitionListBox />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <ListboxFramerMotion />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <ListboxWithMultipleVal />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <RenderingAsDiffElemtns />
        </div>
      </div>
    </>
  );
};

export default page;
