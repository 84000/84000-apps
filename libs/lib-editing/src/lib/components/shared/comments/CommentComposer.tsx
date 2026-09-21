'use client';

import { Button } from '@eightyfourthousand/design-system';
import { useState } from 'react';
import { commentHtmlFromText, commentTextFromHtml } from './comment-html';

/**
 * The box every comment write goes through — a reply, an edit, and the first
 * comment of a thread.
 *
 * HTML in, HTML out. A textarea cannot show markup, so it works in text and
 * converts at the edges; keeping the contract in HTML is what lets a richer
 * editing surface replace the inside of this without touching its callers.
 */
export const CommentComposer = ({
  initialValue = '',
  placeholder = 'Reply…',
  submitLabel = 'Reply',
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  /** The comment as stored: an HTML fragment. */
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  /** Called with an HTML fragment. */
  onSubmit: (content: string) => Promise<void> | void;
  onCancel?: () => void;
}) => {
  const initialText = commentTextFromHtml(initialValue);
  const [value, setValue] = useState(initialText);
  const [saving, setSaving] = useState(false);

  const trimmed = value.trim();
  const unchanged = trimmed === initialText;

  const submit = async () => {
    if (!trimmed || unchanged || saving) return;
    setSaving(true);
    try {
      await onSubmit(commentHtmlFromText(trimmed));
      setValue(initialText);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2">
      <textarea
        className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-2 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-16 resize-y"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter alone inserts a newline: a comment is prose, and losing a
          // paragraph break is worse than one extra key for sending.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape' && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-1 mt-1">
        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          onClick={submit}
          disabled={!trimmed || unchanged || saving}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
