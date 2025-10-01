'use client';

import {
  createBrowserClient,
  getGlossaryInstances,
  GlossaryTermInstance,
} from '@data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorProvider';
import { TranslationSkeleton } from './TranslationSkeleton';
import { H2, Separator } from '@design-system';
import { cn, removeHtmlTags, useScrollToHash } from '@lib-utils';
import { LabeledElement } from './LabeledElement';

export const GlossaryInstanceBody = ({
  instance,
  className,
}: {
  instance: GlossaryTermInstance;
  className?: string;
}) => {
  const [definition, setDefinition] = useState<string>();

  useEffect(() => {
    if (!instance?.definition) {
      return;
    }

    const plainText = removeHtmlTags(instance.definition);
    setDefinition(plainText);
  }, [instance.definition, setDefinition]);

  return (
    <div className={cn('p-2 flex gap-1 flex-col', className)}>
      {instance.names.english && (
        <div className="text-xl font-serif font-semibold">
          {instance.names.english}
        </div>
      )}
      {instance.names.wylie && (
        <div className="italic">{instance.names.wylie}</div>
      )}
      {instance.names.tibetan && (
        <div className="text-lg">{instance.names.tibetan}</div>
      )}
      {instance.names.sanskrit && (
        <div className="italic">{instance.names.sanskrit}</div>
      )}
      {instance.names.chinese && <div>{instance.names.chinese}</div>}
      {instance.names.pali && (
        <div className="italic">{instance.names.pali}</div>
      )}
      <Separator className="w-4 h-0.5 my-5 bg-slate/80" />
      {definition && <p>{definition}</p>}
      <div className="text-sm text-mut mt-2">
        <a
          href={`/glossary/${instance.authority}`}
          target="_blank"
          rel="noreferrer"
          className="hover:underline decoration-slate hover:text-slate"
        >
          {'View full entry ›'}
        </a>
      </div>
    </div>
  );
};

export const TranslationGlossaryPage = () => {
  const [content, setContent] = useState<GlossaryTermInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();
  useScrollToHash({ isReady: !loading });

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const items = (await getGlossaryInstances({ client, uuid })) ?? [];
      items.sort((a, b) => {
        if (a.names.english && b.names.english) {
          return a.names.english.localeCompare(b.names.english);
        }
        if (a.names.wylie && b.names.wylie) {
          return a.names.wylie.localeCompare(b.names.wylie);
        }
        return 0;
      });

      setContent(items);
      setLoading(false);
    })();
  }, [uuid]);

  if (loading) {
    return <TranslationSkeleton />;
  }

  return (
    <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 pb-16">
      <LabeledElement className="mt-8" id={'glossary'} label="g.">
        <H2>Glossary</H2>
      </LabeledElement>
      <div className="mt-4 flex flex-col gap-8">
        {content.length === 0 && (
          <div className="text-muted-foreground">No glossary terms found.</div>
        )}
        {content.map((instance, index) => (
          <LabeledElement
            id={instance.uuid}
            key={instance.uuid}
            label={`g.${index + 1}`}
          >
            <GlossaryInstanceBody instance={instance} className="p-0" />
            <div className="mt-8">
              <Separator />
            </div>
          </LabeledElement>
        ))}
      </div>
    </div>
  );
};
