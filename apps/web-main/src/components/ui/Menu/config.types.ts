export type BrandColor = 'brick' | 'ochre' | 'slate' | 'navy' | 'emerald';

export interface StudioHeaderConfig {
  version: number;
  items: MenuItemConfig[];
}

export interface MenuItemConfig {
  title: string;
  color: BrandColor;
  body?: string; // Optional - can be used in hero section
  href?: string; // Optional - only needed if no items
  items: MenuSubItemConfig[];
}

export interface MenuSubItemConfig {
  header: string;
  body: string;
  href: string;
  icon: string; // Lucide icon name, e.g., "BookOpen"
  proxyTo?: string; // MFE destination URL, e.g., "https://external-app.com"
  roles?: string[]; // Required roles (empty = just login required)
  public?: boolean; // No auth required
  showOnHomepage?: boolean; // Show this item on the landing page
}
