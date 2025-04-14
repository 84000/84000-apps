import { ReactNode } from 'react';

export const AppContent = ({ children }: { children: ReactNode }) => {
  return (
    <div className="fixed h-screen pb-(--header-height) w-full overflow-auto">
      {children}
    </div>
  );
};
