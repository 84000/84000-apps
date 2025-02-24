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
interface CustomizerContextState {
  activeMode: string;
  setActiveMode: (mode: string) => void;
  isCollapse: string;
  setIsCollapse: (collapse: string) => void;
  isLanguage: string;
  setIsLanguage: (code: string) => void;
}

// Create the context with an initial value
export const CustomizerContext = createContext<CustomizerContextState>({
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
interface CustomizerContextProps {
  children: ReactNode;
}
// Create the provider component
export const CustomizerContextProvider: React.FC<CustomizerContextProps> = ({
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
    <CustomizerContext.Provider
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
    </CustomizerContext.Provider>
  );
};

export const useUIState = () => useContext(CustomizerContext);
