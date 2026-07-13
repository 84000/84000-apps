'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStudioHeaderConfig } from '@eightyfourthousand/lib-instr';
import type { UserRole } from '@eightyfourthousand/data-access';
import { useSession } from '@lib-user';
import { NavigationMenuItemProps } from './types';
import { MENU_ITEMS } from './MenuItems';
import {
  StudioHeaderConfig,
  MenuItemConfig,
  MenuSubItemConfig,
} from './config.types';
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
 * Determines whether a `roles` gate grants access to the current user's role.
 * - No `roles` list (missing or empty) is open to any logged-in user.
 * - Otherwise the user's role must be included in the `roles` list.
 */
function hasRoleAccess(roles?: string[], role?: UserRole): boolean {
  if (!roles || roles.length === 0) return true;
  return role ? roles.includes(role) : false;
}

/**
 * Determines whether a sub-item is visible for the current user's role.
 * `public` items require no auth and are always visible; otherwise the sub-item's
 * `roles` gate applies.
 */
function isSubItemVisible(sub: MenuSubItemConfig, role?: UserRole): boolean {
  if (sub.public) return true;
  return hasRoleAccess(sub.roles, role);
}

/**
 * Transforms a remote config item to the component props format, filtering out
 * sub-items the current role cannot access. Wraps the visible items in a single
 * section for component compatibility. Returns null when the top-level `roles`
 * gate excludes the user or no sub-items are visible, so inaccessible/empty menu
 * entries can be dropped.
 */
function transformConfigItem(
  item: MenuItemConfig,
  role?: UserRole,
): NavigationMenuItemProps | null {
  if (!hasRoleAccess(item.roles, role)) {
    return null;
  }

  const visibleItems = item.items.filter((subItem) =>
    isSubItemVisible(subItem, role),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return {
    title: item.title,
    color: item.color,
    href: item.href ?? visibleItems[0]?.href ?? '',
    hero: { header: '', body: item.body ?? '', image: '' },
    sections: [
      {
        header: item.title,
        items: visibleItems.map((subItem) => ({
          header: subItem.header,
          body: subItem.body,
          href: subItem.href,
          icon: getIconByName(subItem.icon),
          showOnHomepage: subItem.showOnHomepage,
          isProxy: !!subItem.proxyTo,
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
  const { getUser } = useSession();
  const [role, setRole] = useState<UserRole>();

  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getUser();
      if (active) {
        setRole(user?.role);
      }
    })();
    return () => {
      active = false;
    };
  }, [getUser]);

  return useMemo(() => {
    if (!payload || !isValidConfig(payload)) {
      return MENU_ITEMS;
    }

    try {
      return payload.items
        .map((item) => transformConfigItem(item, role))
        .filter((item): item is NavigationMenuItemProps => item !== null);
    } catch {
      console.warn('Failed to transform studio header config, using fallback');
      return MENU_ITEMS;
    }
  }, [payload, role]);
}
