'use client';

import { useEffect, useRef } from 'react';
import type { GlossaryAuthorityMatch } from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';
import { CheckIcon, XIcon } from 'lucide-react';

/** Asks before relinking the entry, in place of the search. */
export const GlossaryRelinkConfirm = ({
  from,
  to,
  drawsOnStandard,
  onConfirm,
  onCancel,
}: {
  from: string | undefined;
  to: GlossaryAuthorityMatch;
  /** Whether readers see the authority's standard definition. */
  drawsOnStandard: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // The result that opened it is hidden now, so focus moves here.
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-label={`Link to ${to.headword}?`}
      className="flex items-start gap-2 rounded-md border p-3 outline-none"
      data-glossary-entry-relink=""
    >
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium">Link to {to.headword}?</p>
        <p className="text-muted-foreground text-sm">
          The entry moves from <strong>{from ?? 'its authority'}</strong> to{' '}
          <strong>{to.headword}</strong>.
          {drawsOnStandard &&
            ' The definition readers see will change, as it draws on the authority’s standard definition.'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Link"
          onClick={onConfirm}
        >
          <CheckIcon className="text-success" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
};
