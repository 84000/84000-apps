'use client';

import Link from 'next/link';
import { MainLogoSvg } from './MainLogoSvg';

export const MainLogo = ({
  width = 247,
  height = 95,
  fill = '#004570',
}: {
  width?: number;
  height?: number;
  fill?: string;
}) => {
  return (
    <Link href={'/'}>
      <MainLogoSvg
        width={width}
        height={height}
        fill={fill}
        className="block"
      />
    </Link>
  );
};

export default MainLogo;
