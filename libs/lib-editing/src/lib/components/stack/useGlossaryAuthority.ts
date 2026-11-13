'use client';

import { useEffect, useState } from 'react';
import {
  createBrowserClient,
  getGlossaryAuthorities,
  type GlossaryAuthority,
} from '@eightyfourthousand/data-access';

/** The entry's authority: being read, failed, not found, or read. */
export type AuthorityRead =
  | { status: 'reading' }
  | { status: 'error' }
  | { status: 'missing' }
  | { status: 'read'; authority: GlossaryAuthority };

/** The entry's authority, read again when the entry is relinked. */
export const useGlossaryAuthority = (
  uuid: string | undefined,
): AuthorityRead => {
  const [read, setRead] = useState<{
    uuid: string;
    authority: GlossaryAuthority | null | undefined;
  } | null>(null);

  useEffect(() => {
    if (!uuid) return;
    let current = true;
    getGlossaryAuthorities({
      client: createBrowserClient(),
      uuids: [uuid],
    }).then((authorities) => {
      if (current) setRead({ uuid, authority: authorities && authorities[0] });
    });
    return () => {
      current = false;
    };
  }, [uuid]);

  if (!uuid || read?.uuid !== uuid) return { status: 'reading' };
  if (read.authority === null) return { status: 'error' };
  if (!read.authority) return { status: 'missing' };
  return { status: 'read', authority: read.authority };
};
