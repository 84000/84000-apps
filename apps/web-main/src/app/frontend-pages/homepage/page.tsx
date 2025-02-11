import ClientReviews from '../../components/front-pages/homepage/ClientReviews';
import Companies from '../../components/front-pages/homepage/Companies';
import ContactBar from '../../components/front-pages/homepage/ContactBar';
import { FAQ } from '../../components/front-pages/homepage/FAQ';
import FeatureTabs from '../../components/front-pages/homepage/FeatureTabs';
import { Highlights } from '../../components/front-pages/homepage/Highlights';
import MainBanner from '../../components/front-pages/homepage/MainBanner';
import OurClients from '../../components/front-pages/homepage/OurClients';
import OurTeam from '../../components/front-pages/homepage/OurTeam';
import { Packages } from '../../components/front-pages/homepage/Packages';
import { PaymentOptions } from '../../components/front-pages/homepage/Payments';
import PurchaseTemp from '../../components/front-pages/homepage/PurchaseTemp';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Front-Homepage',
};

const page = () => {
  return (
    <>
      <MainBanner />
      <OurClients />
      <FeatureTabs />
      <OurTeam />
      <ContactBar />
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
