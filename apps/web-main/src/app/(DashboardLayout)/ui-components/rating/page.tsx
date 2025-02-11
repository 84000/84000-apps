import React from "react";
import type { Metadata } from "next";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import DefaultRatting from "../../../components/ui-components/Ratting/DefaultRatting";
import WithTextRattings from "../../../components/ui-components/Ratting/WithTextRattings";
import RattingCount from "../../../components/ui-components/Ratting/RattingCount";
import StarRatting from "../../../components/ui-components/Ratting/StarRatting";
import AdvanceRatting from "../../../components/ui-components/Ratting/AdvanceRatting";
export const metadata: Metadata = {
  title: "Ui Ratting",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Rating",
  },
];
const page = () => {
  return (
    <>
      <BreadcrumbComp title="Rating" items={BCrumb} />
      <div className="grid grid-cols-12 gap-30">
        {/* Default */}
        <div className="lg:col-span-4 col-span-12">
          <DefaultRatting />
        </div>
        {/* With Text Rattings */}
        <div className="lg:col-span-4 col-span-12">
          <WithTextRattings />
        </div>
        {/* Ratting Count*/}
        <div className="lg:col-span-4 col-span-12">
          <RattingCount />
        </div>
        {/* Star Ratting*/}
        <div className="lg:col-span-6 col-span-12">
          <StarRatting />
        </div>
        {/* Advance Ratting*/}
        <div className="lg:col-span-6 col-span-12">
          <AdvanceRatting />
        </div>
      </div>
    </>
  );
};

export default page;
