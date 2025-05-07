import { Meta, StoryObj } from '@storybook/react';
import { Calendar, Home, Inbox, Search, Settings } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from './Sidebar';

const items = [
  {
    title: 'Home',
    url: '#',
    icon: Home,
  },
  {
    title: 'Inbox',
    url: '#',
    icon: Inbox,
  },
  {
    title: 'Calendar',
    url: '#',
    icon: Calendar,
  },
  {
    title: 'Search',
    url: '#',
    icon: Search,
  },
  {
    title: 'Settings',
    url: '#',
    icon: Settings,
  },
];

const meta: Meta<typeof Sidebar> = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  args: {
    collapsible: 'icon',
    variant: 'sidebar',
    side: 'left',
  },
  argTypes: {
    collapsible: {
      control: 'radio',
      options: ['icon', 'offcanvas', 'none'],
      defaultValue: 'icon',
    },
    variant: {
      control: 'radio',
      options: ['sidebar', 'floating', 'inset'],
      defaultValue: 'sidebar',
    },
    side: {
      control: 'radio',
      options: ['left', 'right'],
      defaultValue: 'left',
    },
  },
  render: ({ collapsible, variant, side }) => {
    return (
      <SidebarProvider>
        <Sidebar collapsible={collapsible} variant={variant} side={side}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Application</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main>
          <SidebarTrigger />
        </main>
      </SidebarProvider>
    );
  },
};

export default meta;
