'use client';

import Image from 'next/image';
import Logo from '../svg/mini-logo.svg';

export const MiniLogo = ({
  width = 100, // defined in svg
  height = 100, // defined in svg
  className,
}: {
  width?: number | undefined;
  height?: number | undefined;
  className?: string;
}) => {
  return (
    <Image
      src={Logo}
      alt="mini logo"
      className={className}
      width={width}
      height={height}
    />
  );
};

export default MiniLogo;
