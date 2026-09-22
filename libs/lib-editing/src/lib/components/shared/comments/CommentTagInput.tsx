'use client';

import {
  COMMENT_TAG_SUGGESTIONS,
  MAX_COMMENT_TAG_LENGTH,
  normalizeCommentTag,
} from '@eightyfourthousand/data-access';
import { Button, Input } from '@eightyfourthousand/design-system';
import { useState } from 'react';

/**
 * Adds a tag to a comment: any value, with the suggested tags a click away.
 * Collapsed to a button until someone opens it.
 */
export const CommentTagInput = ({
  tags,
  onAdd,
}: {
  /** The comment's current tags, which are not suggested again. */
  tags: string[];
  onAdd: (tag: string) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const close = () => {
    setOpen(false);
    setValue('');
  };

  const add = async (raw: string) => {
    const tag = normalizeCommentTag(raw);
    close();
    if (tag && !tags.includes(tag)) await onAdd(tag);
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
        + Tag
      </Button>
    );
  }

  const suggestions = COMMENT_TAG_SUGGESTIONS.filter(
    (tag) => !tags.includes(tag),
  );

  return (
    <div
      className="flex items-center gap-1 flex-wrap ms-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        aria-label="New tag"
        placeholder="Add a tag"
        maxLength={MAX_COMMENT_TAG_LENGTH}
        className="h-6 w-32 px-2 text-[11px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            // The input's own value: this Input reports changes a render late.
            add(e.currentTarget.value);
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
          onClick={() => add(tag)}
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
