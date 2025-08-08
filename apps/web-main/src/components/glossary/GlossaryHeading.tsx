import { GlossaryPageItem } from '@data-access';
import { Button, H1 } from '@design-system';
import { ArrowLeftIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export const GlossaryHeading = ({ detail }: { detail: GlossaryPageItem }) => {
  const router = useRouter();
  const pathname = usePathname();
  const backPath = pathname.split('/').slice(0, -1).join('/');

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
      <div className="pb-2">
        <H1 className="text-slate pb-2">{detail.headword}</H1>
      </div>
    </>
  );
};
