'use client';
import React, { createContext, useState, ReactNode, useContext } from 'react';
import { TooltipProvider } from '@design-system';

// Define the shape of the context state
interface InterfaceContextState {
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

// Create the context with an initial value
export const InterfaceContext = createContext<InterfaceContextState>({
  isDarkMode: false,
  setIsDarkMode: () => {
    throw new Error('setIsDarkMode is not implemented');
  },
});

// Define the type for the children prop
interface InterfaceContextProps {
  children: ReactNode;
}
// Create the provider component
export const InterfaceContextProvider: React.FC<InterfaceContextProps> = ({
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <InterfaceContext.Provider value={{ isDarkMode, setIsDarkMode }}>
      <TooltipProvider>{children}</TooltipProvider>
    </InterfaceContext.Provider>
  );
};

export const useUIState = () => useContext(InterfaceContext);
