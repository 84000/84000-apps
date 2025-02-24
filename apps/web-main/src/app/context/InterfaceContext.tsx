'use client';
import React, {
  createContext,
  useState,
  ReactNode,
  useEffect,
  useContext,
} from 'react';
import config from './config';

// Define the shape of the context state
interface InterfaceContextState {
  activeMode: string;
  setActiveMode: (mode: string) => void;
  isCollapse: string;
  setIsCollapse: (collapse: string) => void;
  isLanguage: string;
  setIsLanguage: (code: string) => void;
}

// Create the context with an initial value
export const InterfaceContext = createContext<InterfaceContextState>({
  activeMode: config.activeMode,
  isCollapse: config.isCollapse,
  isLanguage: config.isLanguage,
  setActiveMode: () => {
    throw Error('setActiveMode not implemented');
  },
  setIsCollapse: () => {
    throw Error('setIsCollapse not implemented');
  },
  setIsLanguage: () => {
    throw Error('setIsLanguage not implemented');
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
  const [activeMode, setActiveMode] = useState<string>(config.activeMode);
  const [isCollapse, setIsCollapse] = useState<string>(config.isCollapse);
  const [isLanguage, setIsLanguage] = useState<string>(config.isLanguage);

  // Set attributes immediately
  useEffect(() => {
    document.documentElement.setAttribute('class', activeMode);
    document.documentElement.setAttribute('data-sidebar-type', isCollapse);
  }, [activeMode, isCollapse]);

  return (
    <InterfaceContext.Provider
      value={{
        activeMode,
        setActiveMode,
        isCollapse,
        setIsCollapse,
        isLanguage,
        setIsLanguage,
      }}
    >
      {children}
    </InterfaceContext.Provider>
  );
};

export const useUIState = () => useContext(InterfaceContext);
