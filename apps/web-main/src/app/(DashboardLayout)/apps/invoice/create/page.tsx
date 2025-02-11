import BreadcrumbComp from '../../../layout/shared/breadcrumb/BreadcrumbComp';
import React from 'react';
import type { Metadata } from 'next';
import CreateInvoiceApp from '../../../../components/apps/invoice/Add-invoice';
export const metadata: Metadata = {
  title: 'Invoice Create App',
};
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Invoice Create',
  },
];
function CreateList() {
  return (
    <>
      <BreadcrumbComp title=" Create A New Invoice " items={BCrumb} />
      <CreateInvoiceApp />
    </>
  );
}
export default CreateList;
