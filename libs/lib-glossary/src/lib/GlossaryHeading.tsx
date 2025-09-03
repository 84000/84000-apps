'use client';

import { GlossaryPageItem } from '@data-access';
import { Button, H3, Separator } from '@design-system';
import { ArrowLeftIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export const GlossaryHeading = ({ detail }: { detail: GlossaryPageItem }) => {
  const router = useRouter();
  const pathname = usePathname();
  const backPath = pathname.split('/').slice(0, -1).join('/');
  const classifications = detail.classifications.join(', ');

  return (
    <>
      <div className="pt-6">
        <Button
          className="pl-0 text-brick hover:bg-transparent hover:cursor-pointer"
          variant="ghost"
          onClick={() => router.push(backPath)}
        >
          <ArrowLeftIcon />
          Return to Glossaries
        </Button>
      </div>
      <div className="grid gap-2 pb-2">
        <H3 className="text-navy pb-2">{detail.headword}</H3>
        <div className="flex flex-row flex-wrap gap-y-2 gap-x-8 text-sm">
          <div>
            <span className="text-muted-foreground pe-2">Type:</span>
            <span className="text-navy-200">{classifications}</span>
          </div>
          <div className="py-1">
            <Separator
              orientation="vertical"
              className="h-full w-0.5 bg-ochre-300"
            />
          </div>
          <div>
            <span className="text-muted-foreground pe-2">
              Headword Language:
            </span>
            <span className="text-navy-200 capitalize">{detail.language}</span>
          </div>
          <div className="py-1">
            <Separator
              orientation="vertical"
              className="h-full w-0.5 bg-ochre-300"
            />
          </div>
          <div className="truncate">
            <span className="text-muted-foreground pe-2">Authority ID:</span>
            <span className="text-navy-200">{detail.authorityUuid}</span>
            {detail.xmlId && (
              <span className="pl-2 text-navy-200">({detail.xmlId})</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
