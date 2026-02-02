import { ImageResponse } from 'next/og';
import {
  createBrowserClient,
  getTranslationMetadataByUuid,
} from '@data-access';
import { MainLogoSvg } from '@design-system/ssr';
import { isUuid, parseToh } from '@lib-utils';
import { cache } from 'react';

export const runtime = 'nodejs';
export const alt = '84000 Translation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export const OpenGraphImage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  // Only fetch work metadata for valid UUIDs
  let work = null;
  if (isUuid(slug)) {
    const client = createBrowserClient();
    work = await cache(getTranslationMetadataByUuid)({
      client,
      uuid: slug,
    });
  }

  const title = work?.title || '84000 Translation';
  const toh = work?.toh.map(parseToh).join(', ') || '';

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#004570',
        padding: '60px',
      }}
    >
      <MainLogoSvg width={332} height={200} />
      <div
        style={{
          color: 'white',
          fontSize: 48,
          fontWeight: 'bold',
          textAlign: 'center',
          marginTop: '40px',
          maxWidth: '1000px',
        }}
      >
        {title}
      </div>
      {toh && (
        <div
          style={{
            color: '#F18903',
            fontSize: 32,
            marginTop: '20px',
          }}
        >
          {toh}
        </div>
      )}
    </div>,
    { ...size },
  );
};
