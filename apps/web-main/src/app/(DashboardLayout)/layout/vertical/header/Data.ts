//Apps Links Type & Data
interface appsLinkType {
  href: string;
  title: string;
  subtext: string;
  icon: string;
  iconbg: string;
  iconcolor: string;
}

const appsLink: appsLinkType[] = [
  {
    href: '/apps/chats',
    title: 'Chat Application',
    subtext: 'New messages arrived',
    icon: 'solar:chat-line-bold-duotone',
    iconbg: 'bg-lightprimary',
    iconcolor: 'text-primary',
  },
  {
    href: '/apps/ecommerce/shop',
    title: 'eCommerce App',
    subtext: 'New stock available',
    icon: 'solar:widget-6-bold-duotone',
    iconbg: 'bg-lightsecondary',
    iconcolor: 'text-secondary',
  },
  {
    href: '/apps/notes',
    title: 'Notes App',
    subtext: 'To-do and Daily tasks',
    icon: 'solar:notes-bold-duotone',
    iconbg: 'bg-lightwarning',
    iconcolor: 'text-warning',
  },
  {
    href: '/apps/calendar',
    title: 'Calendar App',
    subtext: 'Get dates',
    icon: 'solar:calendar-bold-duotone',
    iconbg: 'bg-lighterror',
    iconcolor: 'text-error',
  },
  {
    href: '/apps/contacts',
    title: 'Contact Application',
    subtext: '2 Unsaved Contacts',
    icon: 'solar:phone-calling-rounded-bold-duotone',
    iconbg: 'bg-lighterror',
    iconcolor: 'text-error',
  },
  {
    href: '/apps/tickets',
    title: 'Tickets App',
    subtext: 'Submit tickets',
    icon: 'solar:ticket-sale-bold-duotone',
    iconbg: 'bg-lightprimary',
    iconcolor: 'text-primary',
  },
  {
    href: '/apps/email',
    title: 'Email App',
    subtext: 'Get new emails',
    icon: 'solar:letter-bold-duotone',
    iconbg: 'bg-lightsuccess',
    iconcolor: 'text-success',
  },
  {
    href: '/apps/blog/post',
    title: 'Blog App',
    subtext: 'added new blog',
    icon: 'solar:chat-square-like-bold-duotone',
    iconbg: 'bg-lightsecondary',
    iconcolor: 'text-secondary',
  },
];

//  Profile Data
interface ProfileType {
  title: string;
  url: string;
}

const profileDD: ProfileType[] = [
  {
    title: 'My Profile',
    url: '/apps/user-profile/profile',
  },
  {
    title: 'Account Settings',
    url: '/theme-pages/account-settings',
  },
  {
    title: 'Sign Out',
    url: '/auth/auth2/login',
  },
];

export { appsLink, profileDD };
