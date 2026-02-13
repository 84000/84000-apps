import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  H1,
} from '@design-system';
import Link from 'next/link';
import { MENU_ITEMS } from '../../components/ui/Menu/MenuItems';
import { CLASSES_FOR_COLOR } from '../../components/ui/Menu/types';

const page = () => {
  return (
    <div className="flex flex-col items-center p-8 size-full bg-surface overflow-y-auto">
      <H1 className="text-navy mb-8">Welcome to 84000 Studio</H1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
        {MENU_ITEMS.map((menuItem) => {
          const colorClasses = CLASSES_FOR_COLOR[menuItem.color];

          return (
            <Card key={menuItem.title} className="flex flex-col">
              <CardHeader className="h-28">
                <CardTitle className={colorClasses.text}>
                  {menuItem.title}
                </CardTitle>
                <CardDescription>{menuItem.hero.body}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-col gap-3">
                  {menuItem.sections.flatMap((section) =>
                    section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors no-underline"
                      >
                        <item.icon
                          className={`size-5 ${colorClasses.text} shrink-0 mt-0.5`}
                        />
                        <div>
                          <div className="font-medium">{item.header}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.body}
                          </div>
                        </div>
                      </Link>
                    )),
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default page;
