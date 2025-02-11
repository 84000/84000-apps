import BreadcrumbComp from '../../../../layout/shared/breadcrumb/BreadcrumbComp';
import BlogDetailData from '../../../../../components/apps/blog/detail';
import React from 'react';
import { BlogProvider } from '../../../../../context/BlogContext/index';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Blog Details',
};

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Blog Detail',
  },
];
const BlogDetail = () => {
  return (
    <>
      <BlogProvider>
        <BreadcrumbComp title="Blog Detail" items={BCrumb} />
        <BlogDetailData />
      </BlogProvider>
    </>
  );
};

export default BlogDetail;
