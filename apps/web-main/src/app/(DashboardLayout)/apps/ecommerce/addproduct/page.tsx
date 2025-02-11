import React from 'react';
import BreadcrumbComp from '../../../../(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp';
import GeneralDetail from '../../../../components/apps/ecommerce/addProduct/GeneralDetail';
import Media from '../../../../components/apps/ecommerce/addProduct/Media';
import Variation from '../../../../components/apps/ecommerce/addProduct/Variation';
import Pricing from '../../../../components/apps/ecommerce/addProduct/Pricing';
import { Button } from 'flowbite-react';
import Thumbnail from '../../../../components/apps/ecommerce/addProduct/Thumbnail';
import Status from '../../../../components/apps/ecommerce/addProduct/Status';
import ProductData from '../../../../components/apps/ecommerce/addProduct/ProductData';
import Producttemplate from '../../../../components/apps/ecommerce/addProduct/ProductTemplate';
import { Metadata } from 'next';
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Add Product',
  },
];
export const metadata: Metadata = {
  title: 'Add Product',
};
const AddProduct = () => {
  return (
    <>
      <BreadcrumbComp title="Add Product" items={BCrumb} />
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

export default AddProduct;
