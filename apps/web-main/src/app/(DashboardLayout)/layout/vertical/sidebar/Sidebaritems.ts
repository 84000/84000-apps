export interface ChildItem {
  id?: number | string;
  name?: string;
  icon?: string;
  children?: ChildItem[];
  item?: unknown;
  url?: string;
  color?: string;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: string;
  id?: number;
  to?: string;
  items?: MenuItem[];
  children?: ChildItem[];
  url?: string;
}

const SidebarContent: MenuItem[] = [
  {
    heading: 'Publications',
    children: [
      {
        name: 'Project Management',
        icon: 'solar:chart-square-outline',
        id: 1,
        url: '/project',
      },
      {
        name: 'Reader',
        icon: 'solar:notebook-minimalistic-outline',
        id: 2,
        url: '/publications/toh251/reader',
      },
      {
        name: 'Editor',
        icon: 'solar:pen-new-square-outline',
        id: 3,
        url: '/publications/toh251/editor',
      },
    ],
  },
];

export default SidebarContent;
