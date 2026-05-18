import {
  getWorkUuidByToh,
  getWorkUuidByXmlid,
} from '@eightyfourthousand/data-access';
import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export const isTohRequest = (pathname: string) => {
  return pathname.match(/^\/toh\d+/);
};

export const isXmlidRequest = (pathname: string) => {
  return pathname.match(/^\/UT(?:22084|23703)-\d{3}-\d{3}/i);
};

export const redirectOnToh = async (pathname: string, request: NextRequest) => {
  const url = request.nextUrl.clone();
  const toh = pathname.split('/')[1]?.split('.')[0];

  if (!toh) {
    return NextResponse.next();
  }

  const client = await createServerClient();
  const workUuid = await getWorkUuidByToh({ client, toh });

  if (!workUuid) {
    return NextResponse.next();
  }

  url.pathname = `/${workUuid}`;
  url.searchParams.set('toh', toh);
  return NextResponse.redirect(url);
};

export const redirectOnXmlid = async (
  pathname: string,
  request: NextRequest,
) => {
  const url = request.nextUrl.clone();
  const xmlid = pathname.split('/')[1]?.split('.')[0];

  if (!xmlid) {
    return NextResponse.next();
  }

  const client = await createServerClient();
  const workUuid = await getWorkUuidByXmlid({ client, xmlid });

  if (!workUuid) {
    return NextResponse.next();
  }

  url.pathname = `/${workUuid}`;
  url.searchParams.set('xmlid', xmlid);
  return NextResponse.redirect(url);
};
