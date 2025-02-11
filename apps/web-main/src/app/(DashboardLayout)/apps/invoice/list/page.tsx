import React from 'react';
import CardBox from '../../../../components/shared/CardBox';
import BreadcrumbComp from '../../../layout/shared/breadcrumb/BreadcrumbComp';
import InvoiceList from '../../../../components/apps/invoice/Invoice-list/index';
import { InvoiceProvider } from '../../../../context/InvoiceContext/index';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Invoice List App',
};
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Invoice List',
  },
];
function List() {
  return (
    <InvoiceProvider>
      <BreadcrumbComp title="Invoice List" items={BCrumb} />
      <CardBox>
        <InvoiceList />
      </CardBox>
    </InvoiceProvider>
  );
}
export default List;
