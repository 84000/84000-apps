'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@design-system';
import { parseToh } from '@lib-utils';
import { FormEvent, useState } from 'react';

export const SuggestRevisionDialog = ({
  open,
  onOpenChange,
  toh,
  type,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toh: string;
  type: string;
  label: string;
}) => {
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      setStatus('error');
      setErrorMessage('Please enter a message.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toh, type, label, body: body.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send feedback');
      }

      setStatus('success');
      setTimeout(() => {
        setBody('');
        setStatus('idle');
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to send feedback',
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Suggest a Revision</DialogTitle>
        <DialogDescription className="capitalize text-secondary">
          {parseToh(toh)} &middot; {type} {label}
        </DialogDescription>
        <form onSubmit={handleSubmit}>
          <textarea
            className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-32 resize-y"
            placeholder="Describe the revision you'd like to suggest..."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
          />
          {status === 'error' && (
            <p className="text-destructive text-sm mt-1">{errorMessage}</p>
          )}
          {status === 'success' && (
            <p className="text-green-600 text-sm mt-1">
              Feedback sent. Thank you!
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              type="submit"
              className="px-5"
              disabled={status === 'loading' || status === 'success'}
            >
              {status === 'loading' ? 'Sending...' : 'Submit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
