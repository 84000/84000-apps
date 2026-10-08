import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { RevisionList, type RevisionListItem } from './RevisionList';

interface SampleRevision {
  uuid: string;
  version: string;
  savedAt: string;
  author: string | null;
  note?: string;
  live?: boolean;
}

const sample: SampleRevision[] = [
  {
    uuid: 'r3',
    version: '3',
    savedAt: '2026-09-30T14:12:00.000Z',
    author: 'Dawa Lhamo',
    note: 'Clarified the glossary rule for Sanskrit names.',
    live: true,
  },
  {
    uuid: 'r2',
    version: '2',
    savedAt: '2026-09-21T09:40:00.000Z',
    author: 'Tenzin Norbu',
  },
  {
    uuid: 'r1',
    version: '1',
    savedAt: '2026-09-02T17:05:00.000Z',
    author: null,
  },
];

const toRevision = (revision: SampleRevision): RevisionListItem => ({
  id: revision.uuid,
  label: `Revision ${revision.version}`,
  timestamp: revision.savedAt,
  meta: revision.author,
  badges: revision.live && <Badge variant="secondary">{'Live'}</Badge>,
  body: revision.note && (
    <span className="mt-1 block text-xs">{revision.note}</span>
  ),
});

const meta: Meta<typeof RevisionList<SampleRevision>> = {
  component: RevisionList,
  title: 'Core/RevisionList',
  tags: ['autodocs'],
  args: {
    title: 'Revision history',
    items: sample,
    toRevision,
    defaultOpen: true,
  },
};

type Story = StoryObj<typeof RevisionList<SampleRevision>>;

export const ReadOnly: Story = {};

export const Collapsed: Story = {
  args: { defaultOpen: false },
};

export const Empty: Story = {
  args: { items: [], emptyMessage: 'This policy has no saved revisions.' },
};

export const Unavailable: Story = {
  args: {
    items: [],
    unavailable: true,
    unavailableMessage: 'The revision history could not be loaded.',
  },
};

export const SelectableWithActions: Story = {
  render: (args) => {
    const [selectedId, setSelectedId] = useState<string>('r3');
    return (
      <RevisionList
        {...args}
        selectedId={selectedId}
        onSelect={(revision) => setSelectedId(revision.uuid)}
        renderActions={(revision) =>
          revision.live ? null : (
            <Button size="sm" variant="outline">
              {'Restore'}
            </Button>
          )
        }
      />
    );
  },
};

export default meta;
