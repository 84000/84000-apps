const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  return <div>My Page {slug}</div>;
};

export default Page;
