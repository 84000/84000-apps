import React from 'react';
import BreadcrumbComp from '../../../layout/shared/breadcrumb/BreadcrumbComp';
import GeneralDetail from '../../../../components/apps/ecommerce/editProduct/GeneralDetail';
import Media from '../../../../components/apps/ecommerce/editProduct/Media';
import Variation from '../../../../components/apps/ecommerce/editProduct/Variation';
import Pricing from '../../../../components/apps/ecommerce/editProduct/Pricing';
import { Button } from 'flowbite-react';
import Thumbnail from '../../../../components/apps/ecommerce/editProduct/Thumbnail';
import Status from '../../../../components/apps/ecommerce/editProduct/Status';
import ProductData from '../../../../components/apps/ecommerce/editProduct/ProductData';
import Producttemplate from '../../../../components/apps/ecommerce/editProduct/ProductTemplate';
import ProductrChart from '../../../../components/apps/ecommerce/editProduct/ProductrChart';
import CustomerReviews from '../../../../components/apps/ecommerce/editProduct/CustomerReviews';
import { Metadata } from 'next';
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Edit Product',
  },
];

export const metadata: Metadata = {
  title: 'Edit Product',
};
const EditProduct = () => {
  return (
    <>
      <BreadcrumbComp title="Edit Product" items={BCrumb} />
      <div className="grid grid-cols-12 gap-[30px]">
        <div className="lg:col-span-8 col-span-12">
          <div className="flex flex-col gap-[30px]">
            {/* General */}
            <GeneralDetail />
            {/* Media  */}
            <Media />
            {/* Variation  */}
            <Variation />
            {/* Pricing  */}
            <Pricing />
            {/* CustomerReviews */}
            <CustomerReviews />
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="flex flex-col gap-[30px]">
            {/* Thumbnail */}
            <Thumbnail />
            {/* Status */}
            <Status />
            {/* ProductData */}
            <ProductData />
            {/* ProductrChart */}
            <ProductrChart />
            {/* Producttemplate */}
            <Producttemplate />
          </div>
        </div>
        <div className="lg:col-span-8 col-span-12">
          <div className="sm:flex gap-3">
            <Button color={'primary'} className="sm:mb-0 mb-3 w-fit">
              Save changes
            </Button>
            <Button color={'lighterror'} className="w-fit">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditProduct;
