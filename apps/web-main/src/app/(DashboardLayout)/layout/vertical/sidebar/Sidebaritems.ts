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

const SidebarContent: MenuItem[] = [
  {
    heading: 'HOME',
    children: [
      {
        name: 'Dashboard',
        icon: 'solar:widget-add-line-duotone',
        id: 1,
        url: '/',
      },
    ],
  },
  {
    heading: 'UTILITIES',
    children: [
      {
        name: 'Typography',
        icon: 'solar:text-circle-outline',
        id: 2,
        url: '/ui/typography',
      },
      {
        name: 'Table',
        icon: 'solar:bedside-table-3-linear',
        id: 3,
        url: '/ui/table',
      },
      {
        name: 'Form',
        icon: 'solar:password-minimalistic-outline',
        id: 4,
        url: '/ui/form',
      },
      {
        name: 'Shadow',
        icon: 'solar:airbuds-case-charge-outline',
        id: 5,
        url: '/ui/shadow',
      },
    ],
  },
  {
    heading: 'AUTH',
    children: [
      {
        name: 'Login',
        icon: 'solar:login-2-linear',
        id: 6,
        url: '/auth/login',
      },
      {
        name: 'Register',
        icon: 'solar:shield-user-outline',
        id: 7,
        url: '/auth/register',
      },
    ],
  },
  {
    heading: 'EXTRA',
    children: [
      {
        name: 'Icons',
        icon: 'solar:smile-circle-outline',
        id: 8,
        url: '/icons/solar',
      },
      {
        name: 'Sample Page',
        icon: 'solar:notes-minimalistic-outline',
        id: 9,
        url: '/sample-page',
      },
    ],
  },
];

export default SidebarContent;
