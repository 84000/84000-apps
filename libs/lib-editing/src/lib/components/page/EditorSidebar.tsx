'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIcon,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@design-system';
import { LetterTextIcon, SparklesIcon } from 'lucide-react';
import { ReactNode, useCallback } from 'react';
import type { EditorMenuItemType } from './types';

interface EditorSidebarItem {
  key: EditorMenuItemType;
  title: string;
}

const englishEditorItems: EditorSidebarItem[] = [
  {
    key: 'titles',
    title: 'Titles',
  },
  {
    key: 'summary',
    title: 'Summary',
  },
  {
    key: 'acknowledgements',
    title: 'Acknowledgements',
  },
  {
    key: 'introduction',
    title: 'Introduction',
  },
  {
    key: 'body',
    title: 'Body',
  },
  {
    key: 'end-notes',
    title: 'End Notes',
  },
];

const toolItems: EditorSidebarItem[] = [
  {
    key: 'summarizer',
    title: 'Summarizer',
  },
];

const isActive = (key: EditorMenuItemType, active: EditorMenuItemType) =>
  key === active;

export const EditorSidebarMenu = ({
  icon,
  name,
  items,
  active,
  onSetActive,
}: {
  icon: ReactNode;
  name: string;
  items: EditorSidebarItem[];
  active: EditorMenuItemType;
  onSetActive: (key: EditorMenuItemType) => void;
}) => {
  return (
    <SidebarMenu>
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              {icon}
              {name}
              <CollapsibleIcon />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                {items.map((item) => (
                  <SidebarMenuSubButton
                    key={item.key}
                    onClick={() => onSetActive(item.key)}
                    isActive={isActive(item.key, active)}
                  >
                    {item.title}
                  </SidebarMenuSubButton>
                ))}
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
};

export const EditorSidebar = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: EditorMenuItemType;
  onClick?: (key: EditorMenuItemType) => void;
}) => {
  const onSetActive = useCallback(
    (key: EditorMenuItemType) => {
      onClick?.(key);
    },
    [onClick],
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="bg-gray/20 b pt-(--header-height)">
          <SidebarGroup className="border-t border-sidebar-border">
            <SidebarGroupLabel>Editors</SidebarGroupLabel>
            <SidebarGroupContent>
              <EditorSidebarMenu
                icon={<LetterTextIcon />}
                name="English Editor"
                items={englishEditorItems}
                active={active}
                onSetActive={onSetActive}
              />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <EditorSidebarMenu
                icon={<SparklesIcon />}
                name="AI Tools"
                items={toolItems}
                active={active}
                onSetActive={onSetActive}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarTrigger className="sticky top-2 left-2 z-50" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
};
