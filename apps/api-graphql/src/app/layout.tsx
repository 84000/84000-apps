import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '84000 GraphQL API',
  description: 'GraphQL API for 84000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
