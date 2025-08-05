import {
  ArrowUpRightIcon,
  BookOpenIcon,
  ChevronLastIcon,
  CloudUploadIcon,
  EditIcon,
  GalleryHorizontalEndIcon,
  GalleryVerticalIcon,
  HeartIcon,
  LayoutListIcon,
  LibraryIcon,
  ListIcon,
} from 'lucide-react';
import { NavigationMenuItemProps } from './AppNavigationMenu';

export const MENU_ITEMS: NavigationMenuItemProps[] = [
  {
    title: 'Publications',
    color: 'brick',
    href: '/publications/reader',
    hero: {
      header: 'The 84000 Reading Room',
      body: 'An immersive reading experience for our publications',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/publications.webp',
    },
    sections: [
      {
        header: 'Reading Room',
        items: [
          {
            header: 'Current Publications',
            body: 'The current publications available in the 84000 Reading Room',
            href: '/publications/reader',
            icon: ListIcon,
          },
          {
            header: 'Last Read',
            body: 'Go to my last publication',
            href: '/publications/reader',
            icon: BookOpenIcon,
          },
          {
            header: 'My Passages',
            body: 'The list of passages stored in my library',
            href: '/publications/reader',
            icon: GalleryVerticalIcon,
          },
        ],
      },
      {
        header: 'Highlights',
        items: [
          {
            header: 'Latest Publications',
            body: 'The list of highlights stored in my library',
            href: '/publications/reader',
            icon: GalleryHorizontalEndIcon,
          },
          {
            header: 'Most Popular Publications',
            body: 'The list of highlights stored in my library',
            href: '/publications/reader',
            icon: HeartIcon,
          },
          {
            header: 'Upcoming Translations',
            body: 'Stay tuned with the translations currently in the pipeline',
            href: '/publications/reader',
            icon: CloudUploadIcon,
          },
        ],
      },
    ],
  },
  {
    title: 'Canon',
    color: 'ochre',
    href: '/canon',
    hero: {
      header: 'The Tibetan Canon',
      body: 'Ways to navigate the catalogs of the Kangyur and Tengyur',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/canon.webp',
    },
    sections: [
      {
        header: 'The Kangyur',
        items: [
          {
            header: 'Major Divisions',
            body: 'The major divisions of the Degé Kangyur Canon',
            href: '/canon',
            icon: ListIcon,
          },
          {
            header: 'Kangyur Catalog',
            body: 'A complete catalog of the Degé Kangyur including sections and texts ',
            href: '/canon',
            icon: LibraryIcon,
          },
          {
            header: 'Content +',
            body: 'Additional content of the Degé Kangyur Canon',
            href: '/canon',
            icon: LayoutListIcon,
          },
        ],
      },
      {
        header: 'The Tengyur',
        items: [
          {
            header: 'Major Divisions',
            body: 'The major divisions of the Degé Tengyur Canon',
            href: '/canon',
            icon: ListIcon,
          },
          {
            header: 'Tengyur Catalog',
            body: 'A complete catalog of the Degé Tengyur including sections and texts ',
            href: '/canon',
            icon: LibraryIcon,
          },
          {
            header: 'Content +',
            body: 'Additional content of the Degé Tengyur Canon',
            href: '/canon',
            icon: LayoutListIcon,
          },
        ],
      },
    ],
  },
  {
    title: 'Glossaries',
    color: 'slate',
    href: '/glossary',
    hero: {
      header: '84000 Glossaries',
      body: 'A collection of glossaries for Tibetan terms and concepts',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/glossaries.webp',
    },
    sections: [
      {
        header: 'Tibetan Glossaries',
        items: [
          {
            header: 'All Glossaries',
            body: 'All terms used in translations',
            href: '/glossary',
            icon: ListIcon,
          },
          {
            header: 'Tibetan-English Glossary',
            body: 'A glossary of Tibetan terms with English translations',
            href: '/glossaries',
            icon: LibraryIcon,
          },
          {
            header: 'Tibetan-Sanskrit Glossary',
            body: 'A glossary of Tibetan terms with Sanskrit translations',
            href: '/glossaries',
            icon: LayoutListIcon,
          },
        ],
      },
    ],
  },
  {
    title: 'Research Library',
    color: 'navy',
    href: '/research-library',
    hero: {
      header: '84000 Research Library',
      body: 'A hub of scholarly resources for the research and study of Tibetan Canon',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/research-library.webp',
    },
    sections: [
      {
        header: 'Resource Navigator',
        items: [
          {
            header: 'All Resources',
            body: 'Navigate resources in the 84000 Research Library for research',
            href: '/research-library',
            icon: ListIcon,
          },
          {
            header: 'Primary Resources',
            body: 'Tibetan, Sanskrit, Pali and Chinese resources',
            href: '/research-library',
            icon: LibraryIcon,
          },
          {
            header: 'Secondary Resources',
            body: 'Secondary resource description',
            href: '/research-library',
            icon: LayoutListIcon,
          },
        ],
      },
      {
        header: 'Types',
        items: [
          {
            header: 'Dictionaries',
            body: 'A bibliographical repository of authoritative works',
            href: '/research-library',
            icon: ListIcon,
          },
          {
            header: 'Articles',
            body: 'A growing collection of academic papers relevant to researchers',
            href: '/research-library',
            icon: LibraryIcon,
          },
          {
            header: 'Dissertations',
            body: 'Explore our collection of audio, video, and interactive media',
            href: '/research-library',
            icon: LayoutListIcon,
          },
        ],
      },
    ],
  },
  {
    title: 'Workflows',
    color: 'emerald',
    href: '/project',
    hero: {
      header: '84000 Workflows',
      body: 'Role-based workflows for the 84000 team for translation and publication ',
      image:
        'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/assets/image/menu/workflows.webp',
    },
    sections: [
      {
        header: 'Project Management',
        items: [
          {
            header: 'All Projects',
            body: 'Projects in the translation pipeline',
            href: '/project',
            icon: ListIcon,
          },
          {
            header: 'Last Edited Project',
            body: 'Go to my last project',
            href: '/project',
            icon: ChevronLastIcon,
          },
          {
            header: 'Quick Access',
            body: 'The list of projects saved in my dashboard',
            href: '/project',
            icon: ArrowUpRightIcon,
          },
        ],
      },
      {
        header: 'Translation Editor',
        items: [
          {
            header: 'All Translations',
            body: 'Our pipeline of  translation for editing',
            href: '/publications/editor',
            icon: ListIcon,
          },
          {
            header: 'Last Edited Translation',
            body: 'Go to my last edited translation',
            href: '/publications/editor',
            icon: EditIcon,
          },
          {
            header: 'Quick Access',
            body: 'The list of translations saved in my dashboard',
            href: '/publications/editor',
            icon: ArrowUpRightIcon,
          },
        ],
      },
    ],
  },
];
