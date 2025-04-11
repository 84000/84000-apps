import { ReactNode } from 'react';

export const AppContent = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="xl:max-w-1/2 lg:max-w-2/3 sm:max-w-4/5 w-full">
        {children}
      </div>
    </div>
  );
};
