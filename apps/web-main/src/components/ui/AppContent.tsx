import { ReactNode } from 'react';

export const AppContent = ({ children }: { children: ReactNode }) => {
  return <div className="size-full overflow-auto">{children}</div>;
};
