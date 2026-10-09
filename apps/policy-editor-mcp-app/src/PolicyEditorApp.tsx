import {
  Badge,
  Button,
  MutedText,
} from '@eightyfourthousand/design-system/core';
import {
  PolicyEditor,
  type PolicyPermissions,
  type PolicySource,
} from '@eightyfourthousand/lib-editing/policy-editor';
import { useMemo, useRef, useState } from 'react';
import {
  changeFromSaved,
  createPolicyChangeReporter,
  describePolicyChange,
  type MessageApp,
  type ModelContextApp,
  type PolicyChange,
  tellClaude,
} from './model-context';

/** Props for {@link PolicyEditorApp}. */
export type PolicyEditorAppProps = {
  /** The connected ext-apps `App`, or anything with the same two methods. */
  app: ModelContextApp & MessageApp;
  source: PolicySource;
  permissions: PolicyPermissions;
  initialName?: string;
};

type Telling = 'idle' | 'sending' | 'sent' | 'failed';

const TELLING_TEXT: Record<Telling, string> = {
  idle: '',
  sending: 'Telling Claude…',
  sent: 'Claude was told.',
  failed: 'Could not tell Claude.',
};

/** The user's permissions, in a word or two. */
export const permissionLabel = ({ read, edit, admin }: PolicyPermissions) => {
  if (!read) return 'No access';
  if (admin) return 'Admin';
  return edit ? 'Can edit' : 'Read-only';
};

/**
 * The policy editor inside an MCP App. Reports every change to the model
 * context, which some hosts ignore, and offers a "Tell Claude" button that
 * posts the last change as a visible message.
 */
export const PolicyEditorApp = ({
  app,
  source,
  permissions,
  initialName,
}: PolicyEditorAppProps) => {
  const report = useMemo(() => createPolicyChangeReporter(app), [app]);
  const [last, setLast] = useState<PolicyChange>();
  const [telling, setTelling] = useState<Telling>('idle');
  // The change `telling` describes; a later change makes a pending send stale.
  const current = useRef<PolicyChange>(undefined);

  const changed = (change: PolicyChange) => {
    current.current = change;
    setLast(change);
    setTelling('idle');
    void report(change);
  };

  const tell = async () => {
    if (!last) return;
    setTelling('sending');
    const sent = await tellClaude(app, last);
    if (current.current === last) setTelling(sent ? 'sent' : 'failed');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-sm">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <h1 className="me-auto font-semibold">Translation policies</h1>
        <MutedText role="status" className="empty:hidden">
          {TELLING_TEXT[telling]}
        </MutedText>
        {last && (
          <Button
            variant="outline"
            size="sm"
            title={describePolicyChange(last)}
            disabled={telling === 'sending' || telling === 'sent'}
            onClick={() => void tell()}
          >
            Tell Claude
          </Button>
        )}
        <Badge variant="outline">{permissionLabel(permissions)}</Badge>
      </header>
      <PolicyEditor
        className="min-h-0 flex-1"
        source={source}
        permissions={permissions}
        initialName={initialName}
        onSaved={(saved) => changed(changeFromSaved(saved))}
        onDeleted={({ name, archivedPath }) =>
          changed({ kind: 'deleted', name, archivedPath })
        }
        onRenamed={({ from, to, archivedPath }) =>
          changed({ kind: 'renamed', from, to, archivedPath })
        }
      />
    </div>
  );
};
