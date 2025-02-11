"use client";
import React, { useContext, useEffect } from "react";

import CardBox from "@/app/components/shared/CardBox";
import TicketFilter from "@/app/components/apps/tickets/TicketFilter";
import TicketListing from "@/app/components/apps/tickets/TicketListing";
import { TicketProvider } from '@/app/context/TicketContext/index';


const TicketsApp = () => {

  return (
    <>
      <TicketProvider>
        <CardBox>
          <TicketFilter />
          <TicketListing />
        </CardBox>
      </TicketProvider>
    </>
  );
};

export default TicketsApp;
