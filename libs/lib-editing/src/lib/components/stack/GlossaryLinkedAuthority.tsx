'use client';

import { useRef, useState } from 'react';
import type {
  GlossaryAuthority,
  GlossaryAuthorityMatch,
} from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';
import { PencilIcon, XIcon } from 'lucide-react';

import { GlossaryAuthoritySearch } from '../shared/glossary/GlossaryAuthoritySearch';
import { nameLanguageLabel } from '../shared/glossary/glossary-languages';
import { GlossaryDefinition } from './GlossaryDefinition';
import {
  GlossaryEntrySaveStatus,
  type GlossaryEntrySaves,
} from './GlossaryEntrySaves';
import { GlossaryRelinkConfirm } from './GlossaryRelinkConfirm';
import type { AuthorityRead } from './useGlossaryAuthority';

/** The authority's headword, styled as the search results show one. */
const AuthorityHeading = ({ authority }: { authority: GlossaryAuthority }) => (
  <span className="flex flex-wrap items-baseline gap-x-2">
    <span className="text-primary font-sans text-base font-bold">
      {authority.headword}
    </span>
    <span className="text-muted-foreground text-xs">
      {nameLanguageLabel(authority.headwordLanguage)}
    </span>
  </span>
);

/** The entry's authority, and the search that relinks it. */
export const GlossaryLinkedAuthority = ({
  read,
  saves,
  readOnly,
  drawsOnStandard,
}: {
  read: AuthorityRead;
  saves: GlossaryEntrySaves;
  readOnly: boolean;
  drawsOnStandard: boolean;
}) => {
  const [searching, setSearching] = useState(false);
  const [relinking, setRelinking] = useState<GlossaryAuthorityMatch | null>(
    null,
  );
  const current = read.status === 'read' ? read.authority : null;
  const headingRef = useRef<HTMLDivElement>(null);
  const searchingRef = useRef<HTMLDivElement>(null);

  // Focus moves once the button or result it lands on is drawn.
  const focusLater = (find: () => HTMLElement | null | undefined) =>
    requestAnimationFrame(() => find()?.focus());

  const stop = () => {
    setRelinking(null);
    setSearching(false);
    focusLater(() => headingRef.current?.querySelector('button'));
  };

  const cancelRelink = () => {
    const uuid = relinking?.uuid;
    setRelinking(null);
    focusLater(() =>
      searchingRef.current?.querySelector<HTMLElement>(
        `[data-authority-uuid="${uuid}"]`,
      ),
    );
  };

  const confirm = () => {
    if (!relinking) return;
    saves.save('authorityUuid', { authorityUuid: relinking.uuid });
    stop();
  };

  return (
    <div className="flex flex-col gap-2" data-glossary-entry-authority="">
      {read.status === 'reading' && (
        <p className="text-muted-foreground text-sm">Reading the authority…</p>
      )}
      {read.status === 'error' && (
        <p role="alert" className="text-destructive text-sm">
          The authority could not be read.
        </p>
      )}
      {read.status === 'missing' && (
        <p className="text-muted-foreground text-sm">
          The linked authority was not found.
        </p>
      )}
      {(current || !readOnly) && (
        <div ref={headingRef} className="flex items-center gap-2">
          {current ? <AuthorityHeading authority={current} /> : <span />}
          {!readOnly &&
            (searching ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Stop searching"
                onClick={stop}
              >
                <XIcon />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Link another authority"
                disabled={!saves.canSave}
                onClick={() => setSearching(true)}
              >
                <PencilIcon />
              </Button>
            ))}
        </div>
      )}
      {current && (
        <GlossaryDefinition
          html={current.definition}
          empty="This authority has no standard definition."
          data-glossary-entry-standard=""
        />
      )}
      <GlossaryEntrySaveStatus saves={saves} field="authorityUuid" />
      {!readOnly && searching && (
        <div
          ref={searchingRef}
          className="flex flex-col gap-2"
          onKeyDown={(event) => {
            // The dialog leaves Escape here: it steps back, not out.
            if (event.key !== 'Escape') return;
            if (relinking) cancelRelink();
            else stop();
          }}
          data-glossary-entry-searching=""
        >
          {relinking && (
            <GlossaryRelinkConfirm
              from={current?.headword}
              to={relinking}
              drawsOnStandard={drawsOnStandard}
              onConfirm={confirm}
              onCancel={cancelRelink}
            />
          )}
          {/* Kept while confirming, so cancelling returns to the results. */}
          <div hidden={!!relinking}>
            <GlossaryAuthoritySearch
              autoFocus
              boundedResults={false}
              currentUuid={current?.uuid}
              disabled={!saves.canSave}
              onSelect={setRelinking}
            />
          </div>
        </div>
      )}
    </div>
  );
};
