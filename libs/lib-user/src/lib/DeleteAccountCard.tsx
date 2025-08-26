'use client';

import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@design-system';
import { ScholarUser } from './types';

export const DeleteAccountCard = ({ user }: { user?: ScholarUser }) => {
  return (
    <Card className="border-destructive">
      <CardHeader className="border-b">
        <CardTitle>Delete Account</CardTitle>
        <CardDescription>
          This will permanently delete your workspace and all saved resources.
          Please note that this action is irreversible, so proceed with caution.
        </CardDescription>
      </CardHeader>
      <CardFooter className="py-4 bg-destructive/10">
        <div className="flex flex-row justify-between w-full bg-red">
          <span className="text-destructive my-auto">
            This action cannot be undone!
          </span>
          <Button
            className="rounded-full"
            variant="destructive"
            disabled={!user}
          >
            Delete Account
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
