'use client';

import Link from 'next/link';
import { MainLogoSvg } from './MainLogoSvg';

export const MainLogo = ({
  width = 166,
  height = 100,
}: {
  width?: number;
  height?: number;
}) => {
  return (
    <Link href={'/'}>
      <MainLogoSvg width={width} height={height} className="block" />
    </Link>
  );
};

export default MainLogo;
