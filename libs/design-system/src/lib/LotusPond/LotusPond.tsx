'use client';

import Image from 'next/image';

export const LotusPond = ({ className }: { className?: string }) => {
  return (
    <Image
      src="/images/lotus-pond.png"
      alt="Lotus Pond"
      className={className}
      width={840}
      height={464}
    />
  );
};
