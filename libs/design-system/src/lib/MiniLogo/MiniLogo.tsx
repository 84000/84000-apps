'use client';

import Image from 'next/image';
import Logo from '../svg/mini-logo.svg';
import Link from 'next/link';

export const MiniLogo = ({
  width = 100, // defined in svg
  height = 100, // defined in svg
}: {
  width?: number | undefined;
  height?: number | undefined;
}) => {
  return (
    <Link href={'/'}>
      <Image
        src={Logo}
        alt="mini logo"
        className="block"
        width={width}
        height={height}
      />
    </Link>
  );
};

export default MiniLogo;
