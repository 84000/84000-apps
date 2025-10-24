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
import { PanelName, TabName } from './types';
import { MenuIcon } from 'lucide-react';

const TAB_FOR_SECTION: Record<string, TabName> = {
  abbreviations: 'abbreviations',
  acknowledgment: 'summary',
  appendix: 'translation',
  bibliography: 'bibliography',
  colophon: 'translation',
  endnotes: 'endnotes',
  glossary: 'glossary',
  homage: 'translation',
  imprint: 'imprint',
  introduction: 'translation',
  prelude: 'translation',
  prologue: 'translation',
  summary: 'summary',
  translation: 'translation',
};

export const TableOfContentsSection = ({
  node,
  className,
  panel,
  depth = 0,
}: {
  node: TocEntry;
  className?: string;
  depth?: number;
  panel?: PanelName;
}) => {
  const { updatePanel } = useNavigation();

  const baseStyle =
    'w-full py-2 font-normal leading-6 text-sm text-primary hover:text-primary/60 hover:no-underline hover:cursor-pointer';
  const depthClass = `pl-${depth * 2}`;

  const onClick = useCallback(
    (entry: TocEntry) => {
      if (panel) {
        updatePanel({
          name: panel,
          state: { open: true, tab: TAB_FOR_SECTION[entry.section] },
        });
      }
    },
    [panel, updatePanel],
  );

  if (!node.children?.length) {
    return null;
  }

  return (
    <Accordion type="multiple" className={depthClass}>
      {node.children.map((child) => {
        return child.children?.length ? (
          <AccordionItem
            key={child.uuid}
            value={child.uuid}
            className="border-b-0"
          >
            <AccordionTrigger className={cn(baseStyle, className)}>
              <a
                className="line-clamp-2"
                href={`#${child.uuid}`}
                onClick={() => onClick(child)}
              >
                {child.content}
              </a>
            </AccordionTrigger>
            <AccordionContent className={cn(depthClass, 'py-0')}>
              <TableOfContentsSection node={child} depth={depth + 1} />
            </AccordionContent>
          </AccordionItem>
        ) : (
          <div key={child.uuid} className={baseStyle}>
            <a
              href={`#${child.uuid}`}
              className="line-clamp-2"
              onClick={() => onClick(child)}
            >
              {child.content}
            </a>
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

  useEffect(() => {
    const currentToh = toh || work.toh[0] || '';
    setLocalToh(currentToh);
  }, [toh, work.toh, setToh]);

  const baseStyle = 'w-full py-2 font-normal leading-6 text-sm text-primary';
  const frontMatter: TocEntry = {
    uuid: 'front-matter',
    content: 'Front Matter',
    sort: 0,
    level: 0,
    section: 'acknowledgment',
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
    section: 'introduction',
    children: toc?.body || [],
  };
  const backMatter: TocEntry = {
    uuid: 'back-matter',
    content: 'Back Matter',
    sort: 0,
    level: 0,
    section: 'endnotes',
    children: [
      ...(toc?.backMatter || []),
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
    ],
  };
  return (
    <div>
      <div className="pt-8 gap-2.5 flex text-navy font-semibold">
        <div className="size-5 my-auto bg-ochre-300 text-background rounded-md">
          <MenuIcon className="size-full p-1" />
        </div>
        Table of Contents
      </div>
      <Separator className="my-4" />
      <div className="pb-2 text-sm uppercase text-slate">Title</div>
      <div className={baseStyle}>{work.title}</div>
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
              'p-0 font-semibold bg-transparent border-none',
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
        <div className={cn(baseStyle, 'font-semibold pt-3')}>
          {parseToh(localToh || '')}
        </div>
      )}
      <div className={baseStyle}>{imprint?.section || work.section}</div>
      <Separator className="my-4" />
      <div className="pb-2 text-sm uppercase text-slate">Front Matter</div>
      <TableOfContentsSection node={frontMatter} panel="left" />
      <Separator className="my-4" />
      <div className="pb-2 text-sm uppercase text-slate">Translation</div>
      <TableOfContentsSection node={body} panel="main" />
      <Separator className="my-4" />
      <div className="pb-2 text-sm uppercase text-slate">Back Matter</div>
      <TableOfContentsSection node={backMatter} panel="right" />
    </div>
  );
};
