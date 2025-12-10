import Image from 'next/image';
import Svg from '../svg/vajrasattva.svg';

export const Vajrasattva = ({
  width = 128,
  height = 128,
  className,
}: {
  width?: number | undefined;
  height?: number | undefined;
  className?: string;
}) => {
  return (
    <Image
      src={Svg}
      alt="vajrasattva"
      className={className}
      width={width}
      height={height}
    />
  );
};
