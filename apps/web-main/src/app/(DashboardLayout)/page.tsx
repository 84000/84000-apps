'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  H1,
} from '@design-system';
import Link from 'next/link';
import { useMenuConfig } from '../../components/ui/Menu/useMenuConfig';
import { CLASSES_FOR_COLOR } from '../../components/ui/Menu/types';

const Page = () => {
  const menuItems = useMenuConfig();

  return (
    <div className="flex flex-col items-center p-8 size-full bg-surface overflow-y-auto">
      <H1 className="text-navy mb-8">Welcome to 84000 Studio</H1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
        {menuItems.map((menuItem) => {
          const colorClasses = CLASSES_FOR_COLOR[menuItem.color];
          const homepageItems = menuItem.sections.flatMap((section) =>
            section.items.filter((item) => item.showOnHomepage === true),
          );

          if (homepageItems.length === 0) return null;

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
                  {homepageItems.map((item) => {
                    const className =
                      'flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors no-underline';
                    const fragment = (
                      <>
                        <item.icon
                          className={`size-5 ${colorClasses.text} shrink-0 mt-0.5`}
                        />
                        <div>
                          <div className="font-medium">{item.header}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.body}
                          </div>
                        </div>
                      </>
                    );

                    return item.isProxy ? (
                      <a key={item.href} href={item.href} className={className}>
                        {fragment}
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={className}
                      >
                        {fragment}
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Page;
