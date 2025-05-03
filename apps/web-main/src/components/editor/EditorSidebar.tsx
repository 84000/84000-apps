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
  SidebarTrigger,
} from '@design-system';
import { LetterTextIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

export type EditorSidebarKey =
  | 'title'
  | 'summary'
  | 'acknowledgements'
  | 'introduction'
  | 'body'
  | 'end-notes'
  | 'bibliography'
  | 'glossary';

interface EditorSidebarItem {
  key: EditorSidebarKey;
  title: string;
}

const englishEditorItems: EditorSidebarItem[] = [
  {
    key: 'title',
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

const isActive = (key: EditorSidebarKey, active: EditorSidebarKey) =>
  key === active;

export const EditorSidebar = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: (key: EditorSidebarKey) => void;
}) => {
  const [active, setActive] = useState<EditorSidebarKey>('body');
  const onSetActive = useCallback(
    (key: EditorSidebarKey) => {
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
      </Sidebar>
      <SidebarTrigger className="sticky top-2 left-2 z-50" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
};
