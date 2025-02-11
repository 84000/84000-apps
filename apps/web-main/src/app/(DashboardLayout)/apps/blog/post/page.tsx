import BreadcrumbComp from '../../../layout/shared/breadcrumb/BreadcrumbComp';
import BlogPost from '../../../../components/apps/blog/BlogPost';
import { Metadata } from 'next';
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Blog Listing',
  },
];
export const metadata: Metadata = {
  title: 'Blog Post',
};
const Blog = () => {
  return (
    <>
      <BreadcrumbComp title="Blog app" items={BCrumb} />
      <BlogPost />
    </>
  );
};
export default Blog;
