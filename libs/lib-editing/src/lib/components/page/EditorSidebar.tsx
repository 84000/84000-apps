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
import { LetterTextIcon } from 'lucide-react';
import { useCallback } from 'react';
import type { EditorBuilderType } from './types';

interface EditorSidebarItem {
  key: EditorBuilderType;
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

const isActive = (key: EditorBuilderType, active: EditorBuilderType) =>
  key === active;

export const EditorSidebar = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: EditorBuilderType;
  onClick?: (key: EditorBuilderType) => void;
}) => {
  const onSetActive = useCallback(
    (key: EditorBuilderType) => {
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
              <SidebarMenu>
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <LetterTextIcon />
                        English Editor
                        <CollapsibleIcon />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          {englishEditorItems.map((item) => (
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
