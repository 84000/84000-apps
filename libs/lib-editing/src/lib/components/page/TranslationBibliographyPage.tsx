'use client';

import {
  BibliographyEntries,
  createBrowserClient,
  getBibliographyEntries,
} from '@data-access';
import { useEffect, useState } from 'react';
import { TranslationSkeleton } from './TranslationSkeleton';
import { useScrollToHash } from '@lib-utils';
import { useEditorState } from './EditorProvider';
import { H2, H3 } from '@design-system';
import { LabeledElement } from './LabeledElement';

export const TranslationBibliographyPage = () => {
  const [content, setContent] = useState<BibliographyEntries>([]);
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();
  useScrollToHash({ isReady: !loading });

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const items = (await getBibliographyEntries({ client, uuid })) ?? [];
      setContent(items);
      setLoading(false);
    })();
  }, [uuid]);

  if (loading) {
    return <TranslationSkeleton />;
  }

  return (
    <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 pb-16">
      <LabeledElement className="mt-8" id={'bibliography'} label="b.">
        <H2>Bibliography</H2>
      </LabeledElement>
      <div className="mt-4 flex flex-col gap-8">
        {content.length === 0 && (
          <div className="py-16 mx-auto text-muted-foreground">
            No bibliography entries found.
          </div>
        )}
        {content.map((section, i) => (
          <div key={i} className="flex flex-col gap-4">
            {section.heading && (
              <LabeledElement
                className="mt-6"
                id={`${section.heading}-${i}`}
                label={`b.${i + 1}`}
              >
                <H3>{section.heading}</H3>
              </LabeledElement>
            )}
            {section.entries.map((entry, j) => (
              <LabeledElement
                id={entry.uuid}
                key={entry.uuid}
                label={`b.${i + 1}.${j + 1}`}
              >
                <div dangerouslySetInnerHTML={{ __html: entry.html }} />
              </LabeledElement>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
