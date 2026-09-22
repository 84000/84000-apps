'use client';

import {
  MAX_COMMENT_TAG_LENGTH,
  normalizeCommentTag,
} from '@eightyfourthousand/data-access';
import { Button, Input } from '@eightyfourthousand/design-system';
import { useState } from 'react';

/**
 * Picks a tag: any value typed, or one of `suggestions` a click away.
 * Collapsed to a button until someone opens it. What it hands back is
 * normalized, the way a stored tag is.
 */
export const TagPicker = ({
  label,
  inputLabel,
  suggestions,
  onPick,
}: {
  /** The collapsed button's text. */
  label: string;
  /** The input's accessible name. */
  inputLabel: string;
  suggestions: readonly string[];
  onPick: (tag: string) => void | Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const close = () => {
    setOpen(false);
    setValue('');
  };

  const pick = async (raw: string) => {
    const tag = normalizeCommentTag(raw);
    close();
    if (tag) await onPick(tag);
  };

  if (!open) {
    return (
      <Button
        size="xs"
        variant="ghost"
        className="text-[11px] text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <div
      className="flex items-center gap-1 flex-wrap ms-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        aria-label={inputLabel}
        placeholder="Tag"
        maxLength={MAX_COMMENT_TAG_LENGTH}
        className="h-6 w-32 px-2 text-[11px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            // The input's own value: this Input reports changes a render late.
            pick(e.currentTarget.value);
          } else if (e.key === 'Escape') {
            close();
          }
        }}
      />
      {suggestions.map((tag) => (
        <Button
          key={tag}
          size="xs"
          variant="outline"
          className="h-5 px-1.5 text-[10px]"
          // Keeps the input from blurring before the click lands.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(tag)}
        >
          {tag}
        </Button>
      ))}
      <Button
        size="xs"
        variant="ghost"
        className="text-[11px] text-muted-foreground"
        onClick={close}
      >
        Cancel
      </Button>
    </div>
  );
};
