'use client';

import { Toc, TocEntry, TohokuCatalogEntry, Work } from '@data-access';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@design-system';
import { cn, parseToh } from '@lib-utils';
import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from './NavigationProvider';
import {
  PanelName,
  TAB_FOR_SECTION,
  PANEL_FOR_SECTION,
} from './types';
import { BookOpenIcon, HashIcon, LibraryBigIcon } from 'lucide-react';

export const TableOfContentsSection = ({
  node,
  className,
  depth = 0,
  panel,
}: {
  node: TocEntry;
  className?: string;
  depth?: number;
  panel?: PanelName;
}) => {
  const { updatePanel } = useNavigation();

  const baseStyle =
    'w-full py-0.75 font-light leading-5 text-sm hover:text-foreground/40 hover:no-underline hover:cursor-pointer';

  const onClick = useCallback(
    (entry: TocEntry) => {
      const { section } = entry;
      updatePanel({
        name: PANEL_FOR_SECTION[section] || panel,
        state: {
          open: true,
          tab: TAB_FOR_SECTION[section] || 'translation',
          hash: entry.uuid,
        },
      });
    },
    [updatePanel, panel],
  );

  if (!node.children?.length) {
    return null;
  }

  return (
    <Accordion type="multiple" className={cn(depth && 'pl-2.5')}>
      {node.children.map((child) => {
        // 'The Translation' is always bold
        const maybeBold =
          child.content === 'The Translation' ? 'font-bold' : '';
        return child.children?.length ? (
          <AccordionItem
            key={child.uuid}
            value={child.uuid}
            className="border-b-0"
          >
            <AccordionTrigger className={cn(baseStyle, className)}>
              <span
                className={cn('line-clamp-2', maybeBold)}
                onClick={() => onClick(child)}
              >
                {child.content}
              </span>
            </AccordionTrigger>
            <AccordionContent className="border-l border-dotted py-0">
              <TableOfContentsSection node={child} depth={depth + 1} />
            </AccordionContent>
          </AccordionItem>
        ) : (
          <div key={child.uuid} className={baseStyle}>
            <span
              className={cn('line-clamp-2', maybeBold)}
              onClick={() => onClick(child)}
            >
              {child.content}
            </span>
          </div>
        );
      })}
    </Accordion>
  );
};

export const TableOfContents = ({ toc, work }: { toc?: Toc; work: Work }) => {
  const { toh, imprint, setToh } = useNavigation();
  const [localToh, setLocalToh] = useState<TohokuCatalogEntry>(
    work.toh[0] || '',
  );

  const title = imprint?.mainTitles?.en || work.title;

  useEffect(() => {
    const currentToh = toh || work.toh[0] || '';
    setLocalToh(currentToh);
  }, [toh, work.toh, setToh]);

  const baseStyle = 'w-full py-2 leading-6 text-sm font-light text-foreground';
  const frontMatter: TocEntry = {
    uuid: 'front-matter',
    content: 'Front Matter',
    sort: 0,
    level: 0,
    section: 'front',
    children: [
      {
        uuid: 'imprint',
        content: 'Imprint',
        sort: 0,
        level: 0,
        section: 'imprint',
        children: [],
      },
      ...(toc?.frontMatter || []),
    ],
  };
  const body: TocEntry = {
    uuid: 'root',
    content: 'Body',
    sort: 0,
    level: 0,
    section: 'translation',
    children: toc?.body || [],
  };

  const endnotes = toc?.backMatter?.find(
    (entry) => entry.section === 'endnotes',
  );
  const abbreviations = toc?.backMatter?.find(
    (entry) => entry.section === 'abbreviations',
  );
  const otherBackMatter = toc?.backMatter?.filter(
    (entry) =>
      entry.section !== 'endnotes' && entry.section !== 'abbreviations',
  );
  const backMatter: TocEntry = {
    uuid: 'back-matter',
    content: 'Back Matter',
    sort: 0,
    level: 0,
    section: 'back',
    children: [
      ...(endnotes ? [endnotes] : []),
      ...(otherBackMatter || []),
      {
        uuid: 'glossary',
        content: 'Glossary',
        sort: 0,
        level: 0,
        section: 'glossary',
        children: [],
      },
      {
        uuid: 'bibliography',
        content: 'Bibliography',
        sort: 0,
        level: 0,
        section: 'bibliography',
        children: [],
      },
      ...(abbreviations ? [abbreviations] : []),
    ],
  };
  return (
    <div>
      <div className={cn(baseStyle, 'flex gap-2 mt-6')}>
        <div className="size-5 text-primary-200 [&_svg]:stroke-1 [&_svg]:size-5 my-auto">
          <LibraryBigIcon />
        </div>
        <span className="my-auto font-light">
          {imprint?.section || work.section}
        </span>
      </div>
      <div className={cn(baseStyle, 'flex gap-2')}>
        <div className="size-5 text-primary-200 [&_svg]:stroke-1 [&_svg]:size-5 my-auto">
          <BookOpenIcon />
        </div>
        <span className="my-auto font-semibold">{title}</span>
      </div>
      <div className="flex gap-2">
        <div className="size-5 text-primary-200 [&_svg]:stroke-1 [&_svg]:size-5 my-auto">
          <HashIcon />
        </div>
        {work.toh.length > 1 ? (
          <Select
            value={localToh}
            onValueChange={(value) => {
              setToh(value as TohokuCatalogEntry);
            }}
          >
            <SelectTrigger
              className={cn(
                baseStyle,
                'p-0 font-light bg-transparent border-none',
              )}
            >
              <SelectValue placeholder="Select TOH" />
            </SelectTrigger>
            <SelectContent>
              {work.toh.map((tohEntry) => {
                const parsedToh = parseToh(tohEntry);
                return (
                  <SelectItem key={tohEntry} value={tohEntry}>
                    {parsedToh}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        ) : (
          <div className={cn(baseStyle, 'font-light')}>
            {parseToh(localToh || '')}
          </div>
        )}
      </div>
      <Separator className="my-4" />
      <TableOfContentsSection node={frontMatter} panel="left" />
      <Separator className="my-4" />
      <TableOfContentsSection node={body} panel="main" />
      <Separator className="my-4" />
      <TableOfContentsSection node={backMatter} panel="right" />
    </div>
  );
};
