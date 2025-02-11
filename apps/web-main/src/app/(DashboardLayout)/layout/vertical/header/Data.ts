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
    href: "/apps/chats",
    title: "Chat Application",
    subtext: "New messages arrived",
    icon: "solar:chat-line-bold-duotone",
    iconbg: "bg-lightprimary",
    iconcolor: "text-primary",
  },
  {
    href: "/apps/ecommerce/shop",
    title: "eCommerce App",
    subtext: "New stock available",
    icon: "solar:widget-6-bold-duotone",
    iconbg: "bg-lightsecondary",
    iconcolor: "text-secondary",
  },
  {
    href: "/apps/notes",
    title: "Notes App",
    subtext: "To-do and Daily tasks",
    icon: "solar:notes-bold-duotone",
    iconbg: "bg-lightwarning",
    iconcolor: "text-warning",
  },
  {
    href: "/apps/calendar",
    title: "Calendar App",
    subtext: "Get dates",
    icon: "solar:calendar-bold-duotone",
    iconbg: "bg-lighterror",
    iconcolor: "text-error",
  },
  {
    href: "/apps/contacts",
    title: "Contact Application",
    subtext: "2 Unsaved Contacts",
    icon: "solar:phone-calling-rounded-bold-duotone",
    iconbg: "bg-lighterror",
    iconcolor: "text-error",
  },
  {
    href: "/apps/tickets",
    title: "Tickets App",
    subtext: "Submit tickets",
    icon: "solar:ticket-sale-bold-duotone",
    iconbg: "bg-lightprimary",
    iconcolor: "text-primary",
  },
  {
    href: "/apps/email",
    title: "Email App",
    subtext: "Get new emails",
    icon: "solar:letter-bold-duotone",
    iconbg: "bg-lightsuccess",
    iconcolor: "text-success",
  },
  {
    href: "/apps/blog/post",
    title: "Blog App",
    subtext: "added new blog",
    icon: "solar:chat-square-like-bold-duotone",
    iconbg: "bg-lightsecondary",
    iconcolor: "text-secondary",
  },
];

interface LinkType {
  href: string;
  title: string;
}

const pageLinks: LinkType[] = [
  {
    href: "/theme-pages/pricing",
    title: "Pricing Page",
  },
  {
    href: "/auth/auth1/login",
    title: "Authentication Design",
  },
  {
    href: "/auth/auth1/register",
    title: "Register Now",
  },
  {
    href: "/404",
    title: "404 Error Page",
  },
  {
    href: "/apps/kanban",
    title: "Kanban App",
  },
  {
    href: "/apps/user-profile/profile",
    title: "User Application",
  },
  {
    href: "/apps/blog/post",
    title: "Blog Design",
  },
  {
    href: "/apps/ecommerce/checkout",
    title: "Shopping Cart",
  },
];

//   Search Data
interface SearchType {
  href: string;
  title: string;
}

const SearchLinks: SearchType[] = [
  {
    title: "Analytics",
    href: "/dashboards/analytics",
  },
  {
    title: "eCommerce",
    href: "/dashboards/eCommerce",
  },
  {
    title: "CRM",
    href: "/dashboards/crm",
  },
  {
    title: "Contacts",
    href: "/dashboards/eCommerce",
  },
  {
    title: "Posts",
    href: "/dashboards/posts",
  },
  {
    title: "Details",
    href: "/dashboards/details",
  },
];

//   Notification Data
interface NotificationType {
  title: string;
  icon: any;
  subtitle: string;
  bgcolor: string;
  color: string;
  time: string;
}

const Notification: NotificationType[] = [
  {
    icon: "solar:widget-3-line-duotone",
    bgcolor: "bg-lighterror dark:bg-lighterror",
    color: "text-error",
    title: "Launch Admin",
    subtitle: "Just see the my new admin!",
    time: "9:30 AM",
  },
  {
    icon: "solar:calendar-line-duotone",
    bgcolor: "bg-lightprimary dark:bg-lightprimary",
    color: "text-primary",
    title: "Event Today",
    subtitle: "Just a reminder that you have event",
    time: "9:15 AM",
  },
  {
    icon: "solar:settings-line-duotone",
    bgcolor: "bg-lightsecondary dark:bg-lightsecondary",
    color: "text-secondary",
    title: "Settings",
    subtitle: "You can customize this template as you want",
    time: "4:36 PM",
  },
  {
    icon: "solar:widget-4-line-duotone",
    bgcolor: "bg-lightwarning dark:bg-lightwarning ",
    color: "text-warning",
    title: "Launch Admin",
    subtitle: "Just see the my new admin!",
    time: "9:30 AM",
  },
  {
    icon: "solar:calendar-line-duotone",
    bgcolor: "bg-lightprimary dark:bg-lightprimary",
    color: "text-primary",
    title: "Event Today",
    subtitle: "Just a reminder that you have event",
    time: "9:15 AM",
  },
  {
    icon: "solar:settings-line-duotone",
    bgcolor: "bg-lightsecondary dark:bg-lightsecondary",
    color: "text-secondary",
    title: "Settings",
    subtitle: "You can customize this template as you want",
    time: "4:36 PM",
  },
];

//  Profile Data
interface ProfileType {
  title: string;
  url: string;
}

const profileDD: ProfileType[] = [
  {
    title: "My Profile",
    url: "/apps/user-profile/profile",
  },
  {
    title: "My Subscription",
    url: "/theme-pages/pricing",
  },
  {
    title: "My Invoice",
    url: "/apps/invoice",
  },
  {
    title: "Account Settings",
    url: "/theme-pages/account-settings",
  },
  {
    title: "Sign Out",
    url: "/auth/auth2/login",
  },
];

export { appsLink, pageLinks, SearchLinks, Notification, profileDD };
