import Customer from "@/app/components/dashboards/Dashboard1/Customer";
import CustomerChart from "@/app/components/dashboards/Dashboard1/CustomerChart";
import Project from "@/app/components/dashboards/Dashboard1/Project";
import RevenueByProduct from "@/app/components/dashboards/Dashboard1/RevenueByProduct";
import RevenueForcast from "@/app/components/dashboards/Dashboard1/RevenueForcast";
import SalesOverview from "@/app/components/dashboards/Dashboard1/SalesOverview";
import TotalSettelment from "@/app/components/dashboards/Dashboard1/TotalSettelment";
import WelcomeBox from "@/app/components/dashboards/Dashboard1/WelcomeBox";
import YourPerformance from "@/app/components/dashboards/Dashboard1/YourPerformance";
import React from "react";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Dashboard 1",
};

const page = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-30">
        <div className="lg:col-span-5 col-span-12">
          <WelcomeBox />
          <div className="grid grid-cols-12 mt-30 gap-30">
            <div className="md:col-span-6 col-span-12">
              <Customer />
            </div>
            <div className="md:col-span-6 col-span-12">
              <Project />
            </div>
          </div>
        </div>
        <div className="lg:col-span-7 col-span-12">
          <RevenueForcast />
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
      </div>
    </>
  );
};

export default page;
