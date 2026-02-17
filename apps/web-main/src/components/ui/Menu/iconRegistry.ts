import {
  BookOpenIcon,
  Edit3Icon,
  LibraryIcon,
  SearchIcon,
  SquareGanttChartIcon,
  FileTextIcon,
  UsersIcon,
  SettingsIcon,
  FolderIcon,
  GlobeIcon,
  BookMarkedIcon,
  LayersIcon,
  LayoutGridIcon,
  ListIcon,
  PenToolIcon,
  MessageSquareIcon,
  HelpCircleIcon,
  InfoIcon,
  LucideProps,
} from 'lucide-react';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

type LucideIcon = ForwardRefExoticComponent<
  Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
>;

/**
 * Registry of allowed Lucide icons that can be referenced by string name
 * in the PostHog config. Add icons here as needed.
 */
const ICON_REGISTRY: Record<string, LucideIcon> = {
  BookOpen: BookOpenIcon,
  Edit3: Edit3Icon,
  Library: LibraryIcon,
  Search: SearchIcon,
  SquareGanttChart: SquareGanttChartIcon,
  FileText: FileTextIcon,
  Users: UsersIcon,
  Settings: SettingsIcon,
  Folder: FolderIcon,
  Globe: GlobeIcon,
  BookMarked: BookMarkedIcon,
  Layers: LayersIcon,
  LayoutGrid: LayoutGridIcon,
  List: ListIcon,
  PenTool: PenToolIcon,
  MessageSquare: MessageSquareIcon,
  HelpCircle: HelpCircleIcon,
  Info: InfoIcon,
};

/**
 * Default fallback icon when the requested icon name is not in the registry
 */
const FALLBACK_ICON = FileTextIcon;

/**
 * Resolves a string icon name to a Lucide icon component.
 * Returns a fallback icon if the name is not found in the registry.
 */
export function getIconByName(iconName: string): LucideIcon {
  return ICON_REGISTRY[iconName] ?? FALLBACK_ICON;
}

/**
 * Checks if an icon name exists in the registry
 */
export function isValidIconName(iconName: string): boolean {
  return iconName in ICON_REGISTRY;
}
