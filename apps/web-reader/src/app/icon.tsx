import { ImageResponse } from 'next/og';
import { MiniLogoSvg } from '@design-system/ssr';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
      }}
    >
      <MiniLogoSvg width={32} height={32} />
    </div>,
    { ...size },
  );
}
