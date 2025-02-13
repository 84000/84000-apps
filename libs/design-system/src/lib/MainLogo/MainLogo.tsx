'use client';

import Image from 'next/image';
import Logo from '../svg/logo.svg';
import Link from 'next/link';

export const MainLogo = () => {
  return (
    <Link href={'/'}>
      <Image src={Logo} alt="logo" className="block" />
    </Link>
  );
};

export default MainLogo;
