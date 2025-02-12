import { Flowbite } from 'flowbite-react';
import { ReactNode } from 'react';
import { theme } from './theme/theme';

export const FlowbiteTheme = ({ children }: { children: ReactNode }) => {
  return <Flowbite theme={{ theme }}>{children}</Flowbite>;
};

export default FlowbiteTheme;
