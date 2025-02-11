import React from "react";

import GradientBox from "@/app/components/dashboards/Dashboard2/GradientBox";
import Subscriptions from "@/app/components/dashboards/Dashboard2/Subscriptions";
import UsersBox from "@/app/components/dashboards/Dashboard2/UsersBox";
import RevenueForcastChart from "@/app/components/dashboards/Dashboard2/RevenueForcastChart";
import AnnualProfit from "@/app/components/dashboards/Dashboard2/AnnualProfit";
import type { Metadata } from "next";
import NewCustomers from "@/app/components/dashboards/Dashboard2/NewCustomers";
import TotalIncome from "@/app/components/dashboards/Dashboard2/TotalIncome";
import WeeklySchedule from "@/app/components/dashboards/Dashboard2/WeeklySchedule";
import RevenueByProduct from "@/app/components/dashboards/Dashboard1/RevenueByProduct";
import SalesFromLocation from "@/app/components/dashboards/Dashboard2/SalesFromLocation";
import WeeklyStats from "@/app/components/dashboards/Dashboard2/WeeklyStats";
import DailyActivities from "@/app/components/dashboards/Dashboard2/DailyActivivities";
import FigmaCard from "@/app/components/dashboards/Dashboard2/FigmaCard";
export const metadata: Metadata = {
  title: "Dashboard 2",
};
const page = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-30">
        <div className="lg:col-span-6 col-span-12">
          <GradientBox />
        </div>
        <div className="lg:col-span-3 md:col-span-6 col-span-12">
          <Subscriptions />
        </div>
        <div className="lg:col-span-3 md:col-span-6 col-span-12">
          <UsersBox />
        </div>
        <div className="lg:col-span-8 col-span-12">
          <RevenueForcastChart />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <AnnualProfit />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <NewCustomers />
          <TotalIncome />
        </div>
        <div className="lg:col-span-8 col-span-12">
          <WeeklySchedule />
        </div>
        <div className="lg:col-span-8 col-span-12">
          <RevenueByProduct />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <SalesFromLocation />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <WeeklyStats />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <DailyActivities />
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <FigmaCard />
        </div>
      </div>
    </>
  );
};

export default page;
