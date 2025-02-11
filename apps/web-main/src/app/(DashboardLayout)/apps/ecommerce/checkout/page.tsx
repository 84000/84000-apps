import BreadcrumbComp from '../../../layout/shared/breadcrumb/BreadcrumbComp';
import ProductCheckout from '../../../../components/apps/ecommerce/checkout/ProductCheckout';
import CardBox from '../../../../components/shared/CardBox';
import React from 'react';
import { ProductProvider } from '../../../../context/Ecommercecontext/index';
import { Metadata } from 'next';
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Checkout',
  },
];
export const metadata: Metadata = {
  title: 'Checkout App',
};

const Checkout = () => {
  return (
    <>
      <ProductProvider>
        <BreadcrumbComp title="Checkout" items={BCrumb} />
        <CardBox>
          <ProductCheckout />
        </CardBox>
      </ProductProvider>
    </>
  );
};

export default Checkout;
