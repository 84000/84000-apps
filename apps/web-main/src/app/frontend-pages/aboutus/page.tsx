import Archivement from '../../components/front-pages/aboutus/Archivement';
import HeroText from '../../components/front-pages/aboutus/HeroText';
import SetupProcess from '../../components/front-pages/aboutus/SetupProcess';
import ClientReviews from '../../components/front-pages/homepage/ClientReviews';
import Companies from '../../components/front-pages/homepage/Companies';
import { FAQ } from '../../components/front-pages/homepage/FAQ';
import { Highlights } from '../../components/front-pages/homepage/Highlights';
import OurTeam from '../../components/front-pages/homepage/OurTeam';
import { Packages } from '../../components/front-pages/homepage/Packages';
import { PaymentOptions } from '../../components/front-pages/homepage/Payments';
import PurchaseTemp from '../../components/front-pages/homepage/PurchaseTemp';
import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Front-About Us',
};
const page = () => {
  return (
    <>
      <HeroText />
      <SetupProcess />
      <Archivement />
      <OurTeam />
      <ClientReviews />
      <Companies />
      <Highlights />
      <Packages />
      <PaymentOptions />
      <FAQ />
      <PurchaseTemp />
    </>
  );
};

export default page;
