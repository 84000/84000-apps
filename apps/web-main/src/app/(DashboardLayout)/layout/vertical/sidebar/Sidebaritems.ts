export interface ChildItem {
  id?: number | string;
  name?: string;
  icon?: any;
  children?: ChildItem[];
  item?: any;
  url?: any;
  color?: string;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: any;
  id?: number;
  to?: string;
  items?: MenuItem[];
  children?: ChildItem[];
  url?: any;
}

import { uniqueId } from 'lodash';

const SidebarContent: MenuItem[] = [
  {
    heading: 'Tools',
    children: [
      {
        name: 'Dashboard',
        icon: 'solar:atom-line-duotone',
        id: 1,
        url: '/',
      },
      {
        name: 'Sample Page 2',
        icon: 'solar:chart-line-duotone',
        id: 2,
        url: '/sample-page',
      },
    ],
  },
];

export default SidebarContent;
