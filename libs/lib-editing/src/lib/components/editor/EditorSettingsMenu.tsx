'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Switch,
} from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useEditorState } from './EditorProvider';

/**
 * The editor's settings, in the main panel's actions bar. Shown only to users
 * who may edit the work.
 */
export const EditorSettingsMenu = () => {
  const { editPermitted, readOnlyChosen, setReadOnlyChosen } = useEditorState();
  const [switching, setSwitching] = useState(false);

  if (!editPermitted) {
    return null;
  }

  const toggleReadOnly = async () => {
    setSwitching(true);
    try {
      await setReadOnlyChosen(!readOnlyChosen);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'cursor-pointer [&_svg]:size-5 md:[&_svg]:size-7 size-6 md:size-9 [&_svg]:stroke-1 transition-all',
            readOnlyChosen
              ? 'bg-accent text-accent-foreground hover:bg-accent/90'
              : 'text-accent hover:text-accent hover:bg-muted',
          )}
        >
          <Settings2 />
          <span className="sr-only">Editor settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Editor settings</DropdownMenuLabel>
        <DropdownMenuItem
          role="menuitemcheckbox"
          aria-checked={readOnlyChosen}
          disabled={switching}
          className="justify-between gap-4"
          onSelect={(event) => {
            // Keep the menu open, so the switch is seen to move.
            event.preventDefault();
            toggleReadOnly();
          }}
        >
          Read-only
          <Switch
            checked={readOnlyChosen}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
