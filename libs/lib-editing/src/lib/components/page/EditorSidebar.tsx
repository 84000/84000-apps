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
import { LetterTextIcon, LibraryIcon } from 'lucide-react';
import { ReactNode, useCallback } from 'react';
import type { EditorMenuItemType } from './types';
import { BodyItemType } from '@data-access';

interface EditorSidebarItem {
  key: EditorMenuItemType;
  title: string;
}

// titles is not derived from passages, so we add it manually
const ENGLISH_EDITOR_ITEMS: EditorSidebarItem[] = [
  {
    key: 'titles',
    title: 'titles',
  },
];

const TOOL_ITEMS: EditorSidebarItem[] = [
  {
    key: 'glossary',
    title: 'glossary',
  },
  {
    key: 'bibliography',
    title: 'bibliography',
  },
];

// some editor keys need custom titles
const EDITOR_KEY_TO_TITLE: Partial<Record<EditorMenuItemType, string>> = {
  endnote: 'end notes',
};

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
                    className="capitalize"
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
  builders,
  active,
  onClick,
}: {
  children: React.ReactNode;
  builders: BodyItemType[];
  active: EditorMenuItemType;
  onClick?: (key: EditorMenuItemType) => void;
}) => {
  const onSetActive = useCallback(
    (key: EditorMenuItemType) => {
      onClick?.(key);
    },
    [onClick],
  );

  const builderItems = builders.map((builder) => ({
    key: builder,
    title: EDITOR_KEY_TO_TITLE[builder] || builder,
  }));

  const editorItems = [...ENGLISH_EDITOR_ITEMS, ...builderItems];

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
                items={editorItems}
                active={active}
                onSetActive={onSetActive}
              />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <EditorSidebarMenu
                icon={<LibraryIcon />}
                name="Resources"
                items={TOOL_ITEMS}
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
