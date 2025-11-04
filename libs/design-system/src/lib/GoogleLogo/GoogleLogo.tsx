import Image from 'next/image';
import Google from '../svg/google-icon.svg';

export const GoogleLogo = ({
  width = 16,
  height = 16,
}: {
  width?: number | undefined;
  height?: number | undefined;
}) => {
  return (
    <Image
      src={Google}
      alt="google logo"
      className="block"
      width={width}
      height={height}
    />
  );
};

export default GoogleLogo;
