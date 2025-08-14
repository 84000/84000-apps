'use client';

import { CanonHead, CanonNode } from '@data-access';
import { toSlug } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import {
  ReactElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type CanonContextProps = {
  canon: CanonHead;
  current: string;
  breadcrumbs: string[];
  uuidPath: string[];
  setCurrent: (current: string) => void;
  encode: (str: string) => string;
  isActive: (uuid: string) => boolean;
};

export const CanonContext = createContext<CanonContextProps>({
  canon: { children: [] },
  current: 'root',
  breadcrumbs: [],
  uuidPath: [],
  setCurrent: () => {
    throw new Error('useCanonContext must be used within a CanonProvider');
  },
  encode: () => {
    throw new Error('useCanonContext must be used within a CanonProvider');
  },
  isActive: () => {
    throw new Error('useCanonContext must be used within a CanonProvider');
  },
});

export const CanonProvider = ({
  canon,
  children,
}: {
  canon: CanonHead;
  children: ReactElement;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const isRoot = pathname.endsWith('/canon');

  const initialUuid = isRoot
    ? canon.children[0]?.uuid || 'root'
    : pathname.split('/').pop() || 'root';

  const [current, setCurrent] = useState(initialUuid);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [uuidPath, setUuidPath] = useState<string[]>([initialUuid]);

  const encode = useCallback((str: string) => {
    return toSlug(str);
  }, []);

  const isActive = useCallback(
    (uuid: string) => {
      return uuidPath.includes(uuid);
    },
    [uuidPath],
  );

  useEffect(() => {
    // traverse the canon tree to find the current node and build breadcrumbs and setUuidPath
    // return an array of { label: string, uuid: string } objects
    const traverse = (
      node: CanonNode,
      path: string[] = [],
      uuids: string[] = [],
    ): CanonNode | null => {
      const nextPaths = [...path, node.label || ''];
      const nextUuids = [...uuids, node.uuid];
      if (node.uuid === current) {
        setBreadcrumbs(nextPaths.slice(1).map((p) => encode(p)));
        setUuidPath(nextUuids.slice(1));
        return node;
      }

      if (node.children) {
        for (const child of node.children) {
          const result = traverse(child, nextPaths, nextUuids);
          if (result) {
            return result;
          }
        }
      }
      return null;
    };

    console.log('canon route has changed', current);
    traverse({
      uuid: '',
      label: '',
      type: 'root',
      sort: 0,
      children: canon?.children || [],
    });

    router.push(`/canon/${current}`);
  }, [current, encode, canon?.children, router]);

  return (
    <CanonContext.Provider
      value={{
        canon,
        current,
        breadcrumbs,
        uuidPath,
        isActive,
        setCurrent,
        encode,
      }}
    >
      {children}
    </CanonContext.Provider>
  );
};

export const useCanon = () => {
  const context = useContext(CanonContext);
  if (!context) {
    throw new Error('useCanonContext must be used within a CanonProvider');
  }
  return context;
};
