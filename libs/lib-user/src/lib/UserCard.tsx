'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  SaveButton,
} from '@design-system';
import { UploadIcon, UserIcon } from 'lucide-react';
import { type ScholarUser } from './types';

export const UserCard = ({ user }: { user?: ScholarUser }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>
          Your profile picture. Everyone who visits your profile will see this.
        </CardDescription>
      </CardHeader>
      <CardContent className="border-b">
        <div className="mb-4 flex flex-row gap-4">
          <Avatar className="size-10">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback>
              <UserIcon />
            </AvatarFallback>
          </Avatar>
          <Button disabled className="rounded-full" variant="outline">
            <UploadIcon />
            Upload
          </Button>
        </div>
      </CardContent>
      <CardFooter className="py-2">
        <div className="flex flex-row justify-end w-full">
          <SaveButton
            onClick={async () => {
              console.log('saving');
            }}
          />
        </div>
      </CardFooter>
    </Card>
  );
};
