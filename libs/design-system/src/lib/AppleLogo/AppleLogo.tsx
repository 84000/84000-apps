import Image from 'next/image';
import Apple from '../svg/apple-icon.svg';

export const AppleLogo = ({
  width = 16,
  height = 16,
}: {
  width?: number | undefined;
  height?: number | undefined;
}) => {
  return (
    <Image
      src={Apple}
      alt="apple logo"
      className="block"
      width={width}
      height={height}
    />
  );
};

export default AppleLogo;
