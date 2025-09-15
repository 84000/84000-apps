import { ReactNode } from 'react';

export const AppContent = ({ children }: { children: ReactNode }) => {
  return (
    <div className="fixed top-[--header-height] size-full overflow-auto">
      {children}
    </div>
  );
};
