'use client';

import React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@design-system';
import { BookOpenIcon, ChartGanttIcon, NotebookPenIcon } from 'lucide-react';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className="top-(--header-height) !h-[calc(100svh-(--header-height))]"
      collapsible="icon"
      {...props}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Publications</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/project">
                  <ChartGanttIcon />
                  <span>Projects</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/publications/c55aa7e1-31d2-417a-b4d4-918524b3baca/reader">
                  <BookOpenIcon />
                  <span>Reader</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/publications/c55aa7e1-31d2-417a-b4d4-918524b3baca/editor">
                  <NotebookPenIcon />
                  <span>Editor</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
