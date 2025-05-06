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
import { useCallback, useState } from 'react';
import { EditorBuilderType } from './EditorBuilderType';

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
  {
    key: 'bibliography',
    title: 'Bibliography',
  },
  {
    key: 'glossary',
    title: 'Glossary',
  },
];

const isActive = (key: EditorBuilderType, active: EditorBuilderType) =>
  key === active;

export const EditorSidebar = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: (key: EditorBuilderType) => void;
}) => {
  const [active, setActive] = useState<EditorBuilderType>('body');
  const onSetActive = useCallback(
    (key: EditorBuilderType) => {
      setActive(key);
      onClick?.(key);
    },
    [onClick],
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="pt-(--header-height)">
          <SidebarGroup>
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
