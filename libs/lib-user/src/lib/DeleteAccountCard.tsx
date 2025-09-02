'use client';

import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@design-system';
import { useProfile } from './ProfileProvider';
import { useCallback, useState } from 'react';
import { deleteAccount } from '@data-access';
import { useRouter } from 'next/navigation';

const DELETE_TITLE = 'Delete Account';
const DELETE_DESCRIPTION =
  'This will permanently delete your workspace and all saved resources. Please note that this action is irreversible, so proceed with caution.';
const DELETE_FOOTER = 'This action cannot be undone!';

export const DeleteAccountCard = () => {
  const { user, dataClient } = useProfile();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const onDeleteAccount = useCallback(async () => {
    if (!user?.id || !dataClient) {
      return;
    }

    await deleteAccount({ client: dataClient });
    setIsOpen(false);
    router.push('/');
  }, [user?.id, dataClient, router]);

  return (
    <Card className="border-destructive">
      <CardHeader className="border-b">
        <CardTitle>{DELETE_TITLE}</CardTitle>
        <CardDescription>{DELETE_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardFooter className="py-4 bg-destructive/10">
        <div className="flex flex-row justify-between w-full bg-red">
          <span className="text-destructive my-auto">{DELETE_FOOTER}</span>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                className="rounded-full"
                variant="destructive"
                disabled={!user}
              >
                {DELETE_TITLE}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{DELETE_TITLE}</DialogTitle>
              </DialogHeader>
              <DialogDescription>{DELETE_DESCRIPTION}</DialogDescription>
              <div className="mt-4 flex flex-row justify-end w-full gap-4">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={onDeleteAccount}
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardFooter>
    </Card>
  );
};
