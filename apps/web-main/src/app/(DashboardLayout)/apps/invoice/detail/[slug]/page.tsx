import React from 'react';
import CardBox from '../../../../../components/shared/CardBox';
import BreadcrumbComp from '../../../../layout/shared/breadcrumb/BreadcrumbComp';
import { InvoiceProvider } from '../../../../../context/InvoiceContext/index';
import InvoiceDetail from '../../../../../components/apps/invoice/Invoice-detail/index';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Invoice Details App ',
};
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Invoice Details',
  },
];

function InvoiceDetailPage() {
  return (
    <InvoiceProvider>
      <BreadcrumbComp title="Invoice Details" items={BCrumb} />
      <CardBox>
        <InvoiceDetail />
      </CardBox>
    </InvoiceProvider>
  );
}
export default InvoiceDetailPage;
