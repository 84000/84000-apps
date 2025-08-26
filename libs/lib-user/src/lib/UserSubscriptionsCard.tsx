'use client';

import { Button, Card, CardContent, H3, Input } from '@design-system';
import { ScholarUser } from './types';
import { MailIcon } from 'lucide-react';

export const UserSubscriptionsCard = ({ user }: { user?: ScholarUser }) => {
  return (
    <Card>
      <CardContent>
        <div className="w-full py-8 max-w-[36rem] text-center mx-auto">
          <span className="text-muted-foreground text-md">Stay Informed</span>
          <H3 className="font-semibold">
            Subscribe to our Scholar's Room newsletter
          </H3>
          <div className="text-muted-foreground text-lg pt-2">
            Get the latest articles, resources, and special updates delivered
            directly to your inbox.
          </div>
          <form className="flex flex-row gap-3 mt-auto pt-8">
            <div className="relative my-auto w-full">
              <MailIcon className="absolute left-3 h-full w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter your email..."
                className="py-5 pl-10"
              />
            </div>
            <Button className="rounded-full" type="submit">
              Subscribe
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
