import React from "react";
import type { Metadata } from "next";
import ColorBoxes from "@/app/components/dashboards/dashboard3/ColorBoxes";
import RevenueForcastChart from "@/app/components/dashboards/Dashboard2/RevenueForcastChart";
import AnnualProfit from "@/app/components/dashboards/Dashboard2/AnnualProfit";
import YourPerformance from "@/app/components/dashboards/Dashboard1/YourPerformance";
import CustomerChart from "@/app/components/dashboards/Dashboard1/CustomerChart";
import SalesOverview from "@/app/components/dashboards/Dashboard1/SalesOverview";
import RevenueByProduct from "@/app/components/dashboards/Dashboard1/RevenueByProduct";
import TotalSettelment from "@/app/components/dashboards/Dashboard1/TotalSettelment";
import CalendarApp from "@/app/components/apps/calendar";
export const metadata: Metadata = {
  title: "Dashboard 3",
};
const page = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-30">
        <div className="col-span-12">
          <ColorBoxes />
        </div>
        <div className="lg:col-span-8 col-span-12">
          <RevenueForcastChart />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <AnnualProfit />
        </div>
        <div className="lg:col-span-5 col-span-12">
          <YourPerformance />
        </div>
        <div className="lg:col-span-7 col-span-12">
          <div className="grid grid-cols-12 gap-30">
            <div className="md:col-span-6 col-span-12">
              <CustomerChart />
            </div>
            <div className="md:col-span-6 col-span-12">
              <SalesOverview />
            </div>
          </div>
        </div>
        <div className="lg:col-span-8 col-span-12">
          <RevenueByProduct />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <TotalSettelment />
        </div>
        <div className="col-span-12">
          <CalendarApp />
        </div>
      </div>
    </>
  );
};

export default page;
