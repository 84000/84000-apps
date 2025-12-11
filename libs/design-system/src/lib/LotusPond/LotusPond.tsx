'use client';

import Image from 'next/image';
import LotusPondImage from '../assets/images/lotus-pond.png';

export const LotusPond = ({ className }: { className?: string }) => {
  return (
    <Image
      src={LotusPondImage}
      alt="Lotus Pond"
      className={className}
      width={840}
      height={464}
    />
  );
};
