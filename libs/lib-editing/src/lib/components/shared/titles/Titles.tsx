'use client';

import { useState } from 'react';
import {
  BO_TITLE_PREFIX,
  createBrowserClient,
  Imprint,
  saveWorkTitles,
  Titles as TitlesData,
  TitleType,
} from '@eightyfourthousand/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@eightyfourthousand/design-system';
import { TitlesCard } from './TitlesCard';
import { sortTitles, TitleForm } from './TitleForm';

export type TitlesVariant =
  | 'english'
  | 'tibetan'
  | 'comparison'
  | 'front'
  | 'other';

export const Titles = ({
  titles,
  variant = 'english',
  imprint,
  canEdit = false,
  workUuid,
  onTitlesSaved,
}: {
  titles: TitlesData;
  imprint?: Imprint;
  variant?: TitlesVariant;
  canEdit?: boolean;
  /**
   * The work the titles belong to. Required to save; without it the dialog
   * opens read-only, since a new title cannot be attached to anything.
   */
  workUuid?: string;
  /** Called with the saved titles so the surrounding page can re-render. */
  onTitlesSaved?: (titles: TitlesData) => void;
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draft, setDraft] = useState<TitlesData>(() => sortTitles(titles));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Seed the draft on open rather than in an effect, so a cancelled edit is
  // really discarded and a reopened dialog starts from what is currently
  // stored — without a second render to clear the previous draft.
  const setDialogOpen = (open: boolean) => {
    if (open) {
      // Sorted on the way in: the stored order is arbitrary, so the rows would
      // otherwise appear in whatever order Postgres returned them.
      setDraft(sortTitles(titles));
      setError(undefined);
    }
    setIsEditOpen(open);
  };

  const titlesByType = titles.reduce(
    (acc, title) => {
      if (!acc[title.type]) {
        acc[title.type] = [];
      }
      acc[title.type].push(title);
      return acc;
    },
    {} as Record<TitleType, TitlesData>,
  );

  const mainTitles = titlesByType['mainTitle'] || [];

  let header = '';
  let main = '';
  const authors = imprint?.tibetanAuthors || [];

  const footer =
    imprint?.mainTitles?.['Sa-Ltn'] ||
    mainTitles.find((t) => t.language === 'Sa-Ltn')?.title;

  switch (variant) {
    case 'tibetan': {
      const boMain =
        imprint?.mainTitles?.bo ||
        mainTitles.find((t) => t.language === 'bo')?.title;
      header = boMain ? `${BO_TITLE_PREFIX}${boMain || ''}` : '';
      break;
    }
    case 'comparison': {
      const boMain =
        imprint?.mainTitles?.bo ||
        mainTitles.find((t) => t.language === 'bo')?.title;
      const enMain =
        imprint?.mainTitles?.en ||
        mainTitles.find((t) => t.language === 'en')?.title ||
        '';
      header = boMain ? `${BO_TITLE_PREFIX}${boMain || ''}` : '';
      main = enMain;
      break;
    }
    case 'front': {
      const boMain =
        imprint?.mainTitles?.bo ||
        mainTitles.find((t) => t.language === 'bo')?.title;
      header = boMain ? `${BO_TITLE_PREFIX}${boMain || ''}` : '';
      main =
        imprint?.mainTitles?.en ||
        mainTitles.find((t) => t.language === 'en')?.title ||
        mainTitles[0]?.title ||
        '';
      break;
    }
    case 'english':
    default:
      main =
        imprint?.mainTitles?.en ||
        mainTitles.find((t) => t.language === 'en')?.title ||
        mainTitles[0]?.title ||
        '';
      break;
  }

  const save = async () => {
    if (!workUuid) {
      setError('Cannot save titles: no work is associated with this view.');
      return;
    }

    const cleaned = draft.map((title) => ({
      ...title,
      title: title.title.trim(),
    }));
    if (cleaned.some((title) => !title.title)) {
      setError('Every title needs text. Remove any blank rows before saving.');
      return;
    }

    setSaving(true);
    setError(undefined);

    const result = await saveWorkTitles({
      client: createBrowserClient(),
      workUuid,
      titles: cleaned,
      original: titles,
    });

    setSaving(false);

    if (result.error) {
      // The writes are not atomic, so some may have landed. Report what did
      // and leave the dialog open rather than implying nothing changed.
      const applied =
        result.inserted + result.updated + result.deleted > 0
          ? ' Some changes were applied; reload before trying again.'
          : '';
      setError(`Failed to save titles: ${result.error}.${applied}`);
      return;
    }

    onTitlesSaved?.(cleaned);
    setDialogOpen(false);
  };

  return (
    <>
      <TitlesCard
        header={header}
        main={main}
        footer={footer}
        toh={imprint?.toh}
        section={imprint?.section}
        authors={authors}
        attribution={imprint?.isAuthorContested ? 'attributed to' : 'by'}
        authorsJoiner={imprint?.isAuthorContested ? ' or' : ','}
        canEdit={canEdit}
        onEdit={() => setDialogOpen(true)}
      />
      <Dialog open={isEditOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl" showCloseButton={false}>
          <DialogTitle>Edit titles</DialogTitle>
          <DialogDescription>
            Titles are global to this work and go live as soon as they are
            saved. They are not part of the publishing workflow.
          </DialogDescription>
          <div className="max-h-[60vh] overflow-y-auto px-1">
            <TitleForm titles={draft} disabled={saving} onChange={setDraft} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
