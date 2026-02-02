/**
 * Raw SVG version of MiniLogo for use in contexts where next/image is not available
 * (e.g., next/og ImageResponse for OpenGraph images)
 */
export const MiniLogoSvg = ({
  width = 100,
  height = 100,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => (
  <svg
    width={width}
    height={height}
    viewBox="-100 -100 200 200"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M 0 -96 L 46 -50 L 0 -4 L -46 -50 Z" fill="#F18903" />
    <path d="M 96 0 L 50 46 L 4 0 L 50 -46 Z" fill="#004570" />
    <path d="M 0 96 L -46 50 L 0 4 L 46 50 Z" fill="#435E4D" />
    <path d="M -96 0 L -50 -46 L -4 0 L -50 46 Z" fill="#A81452" />
  </svg>
);

export const MiniLogo = MiniLogoSvg;

export default MiniLogo;
