import {
  BookOpenIcon,
  Edit3Icon,
  LibraryIcon,
  SearchIcon,
  SquareGanttChartIcon,
} from 'lucide-react';
import { NavigationMenuItemProps } from './types';

export const MENU_ITEMS: NavigationMenuItemProps[] = [
  {
    title: 'Translations',
    color: 'brick',
    href: '/translations/reader',
    hero: {
      header: 'Translation Tools',
      body: 'Read and edit translations in the 84000 collection',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/publications.webp',
    },
    sections: [
      {
        header: 'Translations',
        items: [
          {
            header: 'Reader',
            body: 'Browse and read published translations',
            href: '/translations/reader',
            icon: BookOpenIcon,
            showOnHomepage: true,
          },
          {
            header: 'Editor',
            body: 'Edit translations in the pipeline',
            href: '/translations/editor',
            icon: Edit3Icon,
            showOnHomepage: true,
          },
        ],
      },
    ],
  },
  {
    title: 'Research Library',
    color: 'navy',
    href: '/research/library',
    hero: {
      header: '84000 Research Library',
      body: 'A hub of scholarly resources for the research and study of Tibetan Canon',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/research-library.webp',
    },
    sections: [
      {
        header: 'Research',
        items: [
          {
            header: 'Library',
            body: 'Upload and manage research library resources',
            href: '/research/library',
            icon: LibraryIcon,
            showOnHomepage: true,
          },
          {
            header: 'Explore',
            body: 'AI-powered exploration of the canon',
            href: '/research/explore',
            icon: SearchIcon,
            showOnHomepage: true,
          },
        ],
      },
    ],
  },
  {
    title: 'Projects',
    color: 'emerald',
    href: '/projects',
    hero: {
      header: '84000 Projects',
      body: 'Manage translation projects in the pipeline',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/workflows.webp',
    },
    sections: [
      {
        header: 'Project Management',
        items: [
          {
            header: 'Translation Projects',
            body: 'View and manage projects in the translation pipeline',
            href: '/projects',
            icon: SquareGanttChartIcon,
            showOnHomepage: true,
          },
        ],
      },
    ],
  },
];
