export type BrandColor = 'brick' | 'ochre' | 'slate' | 'navy' | 'emerald';

export interface StudioHeaderConfig {
  version: number;
  items: MenuItemConfig[];
}

export interface MenuItemConfig {
  title: string;
  color: BrandColor;
  href?: string; // Optional - only needed if no items
  items: MenuSubItemConfig[];
}

export interface MenuSubItemConfig {
  header: string;
  body: string;
  href: string;
  icon: string; // Lucide icon name, e.g., "BookOpen"
}
