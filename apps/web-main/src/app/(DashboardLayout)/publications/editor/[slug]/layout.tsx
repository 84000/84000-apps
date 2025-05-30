import { EditorContextProvider } from '../../../../../components/editor/EditorContext';

const layout = async ({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) => {
  const { slug } = await params;
  return <EditorContextProvider uuid={slug}>{children}</EditorContextProvider>;
};

export default layout;
