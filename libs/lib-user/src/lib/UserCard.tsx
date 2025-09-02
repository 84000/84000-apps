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
  Label,
  SaveButton,
  buttonVariants,
} from '@design-system';
import { cn } from '@lib-utils';
import { UploadIcon, UserIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 } from 'uuid';
import { useProfile } from './ProfileProvider';
import { updateUserProfile, uploadToStorage } from '@data-access';

export const UserCard = () => {
  const { user, dataClient, refreshProfile } = useProfile();
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [localFile, setLocalFile] = useState<File>();
  const inputRef = useRef<HTMLInputElement>(null);

  const clearFile = useCallback(() => {
    setLocalFile(undefined);
    setAvatar(user?.avatar);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [user?.avatar]);

  const saveAvatar = useCallback(async () => {
    if (!localFile || !user?.id || !dataClient) {
      return;
    }

    const ext = localFile.name.split('.').pop();
    const filePath = `${user.id}-${v4()}.${ext}`;
    const avatarUrl = await uploadToStorage({
      client: dataClient,
      bucket: 'avatars',
      path: filePath,
      file: localFile,
    });

    if (!avatarUrl) {
      clearFile();
      return;
    }

    await updateUserProfile({
      client: dataClient,
      userId: user.id,
      ...user,
      avatar: avatarUrl,
    });

    await refreshProfile();
    setLocalFile(undefined);
  }, [localFile, user, dataClient, clearFile, refreshProfile]);

  useEffect(() => {
    setAvatar(user?.avatar);
  }, [user?.avatar]);

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
            <AvatarImage src={avatar} />
            <AvatarFallback>
              <UserIcon />
            </AvatarFallback>
          </Avatar>
          <Label htmlFor="avatar-upload" className="cursor-pointer">
            <div
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'rounded-full',
              )}
            >
              <UploadIcon />
              Upload
            </div>
          </Label>
          <input
            id="avatar-upload"
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setAvatar(URL.createObjectURL(file));
                setLocalFile(file);
              }
            }}
          />
        </div>
      </CardContent>
      <CardFooter className="py-2">
        <div className="flex flex-row justify-end w-full gap-4">
          {localFile && (
            <>
              <span className="text-muted-foreground my-auto">
                Selected file: {localFile.name}
              </span>
              <Button
                variant="outline"
                className="py-6 px-5 rounded-full my-auto"
                onClick={() => clearFile()}
              >
                Clear
              </Button>
            </>
          )}
          <SaveButton onClick={saveAvatar} />
        </div>
      </CardFooter>
    </Card>
  );
};
