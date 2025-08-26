'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@design-system';
import { ScholarUser } from './types';
import { LogOutIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const ProfileDropdown = ({
  user,
  handleLogout,
}: {
  user: ScholarUser;
  handleLogout: () => void;
}) => {
  const router = useRouter();

  return (
    <div className="relative h-full flex flex-col items-end justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="size-10 my-1">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback>
              <UserIcon />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-80 rounded-lg"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-3">
            <div className="flex gap-3">
              <Avatar className="size-10">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>
                  <UserIcon />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col justify-between">
                <span className="truncate font-normal">{user.name}</span>
                <span className="truncate font-normal text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="hover:cursor-pointer"
              onClick={() => router.push('/profile')}
            >
              <span className="w-full p-1 text-left">My Profile</span>
            </DropdownMenuItem>
            <Accordion
              defaultValue="library"
              type="single"
              collapsible
              className="w-full p-1"
            >
              <AccordionItem value="library">
                <AccordionTrigger className="w-full p-2 text-left hover:cursor-pointer hover:no-underline focus-visible:no-underline">
                  My Library
                </AccordionTrigger>
                <AccordionContent className="ml-4 text-sm">
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={() => router.push('/profile/publications')}
                  >
                    Publications
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={() => router.push('/profile/passages')}
                  >
                    Passages
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={() => router.push('/profile/glossaries')}
                  >
                    Glossaries
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={() => router.push('/profile/bibliographies')}
                  >
                    Bibliographies
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={() => router.push('/profile/searches')}
                  >
                    Searches
                  </DropdownMenuItem>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <DropdownMenuItem
              className="hover:cursor-pointer"
              onClick={handleLogout}
            >
              <div className="w-full p-1 flex justify-between">
                <div>Sign Out</div>
                <LogOutIcon className="size-5" />
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
