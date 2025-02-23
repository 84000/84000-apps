'use client';

import Image from 'next/image';
import Logo from '../svg/logo.svg';
import Link from 'next/link';

export const MainLogo = ({
  width = 166, // defined in svg
  height = 100, // defined in svg
}: {
  width?: number | undefined;
  height?: number | undefined;
}) => {
  return (
    <Link href={'/'}>
      <Image
        src={Logo}
        alt="logo"
        className="block"
        width={width}
        height={height}
      />
    </Link>
  );
};

export default MainLogo;
