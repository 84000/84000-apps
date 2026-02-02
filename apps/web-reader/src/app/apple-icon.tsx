import { ImageResponse } from 'next/og';
import { MiniLogoSvg } from '@design-system';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
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
        backgroundColor: 'white',
      }}
    >
      <MiniLogoSvg width={140} height={140} />
    </div>,
    { ...size },
  );
}
