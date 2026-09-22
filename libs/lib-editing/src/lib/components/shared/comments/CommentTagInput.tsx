'use client';

import { COMMENT_TAG_SUGGESTIONS } from '@eightyfourthousand/data-access';
import { TagPicker } from './TagPicker';

/** Adds a tag to a comment, any value, with the suggested tags offered. */
export const CommentTagInput = ({
  tags,
  onAdd,
}: {
  /** The comment's current tags, which are not suggested again. */
  tags: string[];
  onAdd: (tag: string) => Promise<void>;
}) => (
  <TagPicker
    label="+ Tag"
    inputLabel="New tag"
    suggestions={COMMENT_TAG_SUGGESTIONS.filter((tag) => !tags.includes(tag))}
    onPick={(tag) => (tags.includes(tag) ? undefined : onAdd(tag))}
  />
);
