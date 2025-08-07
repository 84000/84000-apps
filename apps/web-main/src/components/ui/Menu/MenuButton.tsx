import { cn } from '@lib-utils';
import { useRouter } from 'next/navigation';
import { MenuSubItem } from './types';

export const MenuButton = ({
  subItem,
  textStyle,
}: {
  subItem: MenuSubItem;
  textStyle?: string;
}) => {
  const router = useRouter();
  return (
    <div
      className="p-2 h-full hover:bg-linear-to-r hover:from-transparent hover:to-accent hover:cursor-pointer rounded-lg transition-colors"
      onClick={() => {
        router.push(subItem.href);
      }}
    >
      <div className="flex gap-1">
        <div className="w-6 me-4">
          <subItem.icon className={cn('size-6 text-ochre')} />
        </div>
        <div className="flex flex-col">
          <div className={cn('text-sm pb-1', textStyle)}>{subItem.header}</div>
          <div className="text-xs text-muted-foreground leading-5">
            {subItem.body}
          </div>
        </div>
      </div>
    </div>
  );
};
