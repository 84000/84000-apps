'use client';

import { useMemo } from 'react';
import { useStudioHeaderConfig } from '@lib-instr';
import { NavigationMenuItemProps } from './types';
import { MENU_ITEMS } from './MenuItems';
import { StudioHeaderConfig, MenuItemConfig } from './config.types';
import { getIconByName } from './iconRegistry';

/**
 * Validates that a config object has the expected structure
 */
function isValidConfig(config: unknown): config is StudioHeaderConfig {
  if (!config || typeof config !== 'object') return false;

  const c = config as StudioHeaderConfig;
  if (typeof c.version !== 'number') return false;
  if (!Array.isArray(c.items)) return false;

  return c.items.every((item) => {
    if (typeof item.title !== 'string') return false;
    if (typeof item.color !== 'string') return false;
    if (!Array.isArray(item.items)) return false;
    // href is optional, but must be string if provided
    if (item.href !== undefined && typeof item.href !== 'string') return false;
    return true;
  });
}

/**
 * Transforms a remote config item to the component props format.
 * Wraps the flat items list in a single section for component compatibility.
 */
function transformConfigItem(item: MenuItemConfig): NavigationMenuItemProps {
  return {
    title: item.title,
    color: item.color,
    href: item.href ?? item.items[0]?.href ?? '',
    hero: { header: '', body: item.body ?? '', image: '' },
    sections: [
      {
        header: item.title,
        items: item.items.map((subItem) => ({
          header: subItem.header,
          body: subItem.body,
          href: subItem.href,
          icon: getIconByName(subItem.icon),
          showOnHomepage: subItem.showOnHomepage,
        })),
      },
    ],
  };
}

/**
 * Hook that returns menu items from PostHog config or falls back to hardcoded items.
 *
 * Usage:
 * ```tsx
 * const menuItems = useMenuConfig();
 * return <SimpleDesktopMenu items={menuItems} />;
 * ```
 */
export function useMenuConfig(): NavigationMenuItemProps[] {
  const payload = useStudioHeaderConfig();

  return useMemo(() => {
    if (!payload || !isValidConfig(payload)) {
      return MENU_ITEMS;
    }

    try {
      return payload.items.map(transformConfigItem);
    } catch {
      console.warn('Failed to transform studio header config, using fallback');
      return MENU_ITEMS;
    }
  }, [payload]);
}
