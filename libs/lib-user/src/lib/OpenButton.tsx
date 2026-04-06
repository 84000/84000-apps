import { Button } from '@eightyfourthousand/design-system';
import { ArrowRightIcon } from 'lucide-react';

export const OpenButton = ({ url }: { url: string }) => {
  return (
    <Button
      className="text-accent hover:cursor-pointer"
      variant="ghost"
      size="icon"
      onClick={() => {
        window.open(url, '_blank');
      }}
    >
      <ArrowRightIcon />
    </Button>
  );
};
