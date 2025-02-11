import React from "react";
import BreadcrumbComp from "../../../(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import { Metadata } from "next";
import EmptyTable from "../../../components/react-tables/empty/page";

export const metadata: Metadata = {
    title: "Empty Table",
};
const BCrumb = [
    {
        to: "/",
        title: "Home",
    },
    {
        title: "Empty Table",
    },
];
function page() {
    return (
        <>
            <BreadcrumbComp title="Empty Table " items={BCrumb} />
            <EmptyTable />
        </>
    );
}

export default page;
