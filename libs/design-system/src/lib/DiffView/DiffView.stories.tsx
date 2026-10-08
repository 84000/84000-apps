import { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DiffView } from './DiffView';

const meta: Meta<typeof DiffView> = {
  component: DiffView,
  title: 'Core/DiffView',
  tags: ['autodocs'],
  args: {
    oldLabel: 'Saved version',
    newLabel: 'Your changes',
    oldText:
      '# Names\n\nKeep Sanskrit names in their stem form.\nUse diacritics.\n',
    newText:
      '# Names\n\nKeep Sanskrit names in their stem form, without inflection.\nUse diacritics.\nGloss each name once.\n',
  },
};

export default meta;

type Story = StoryObj<typeof DiffView>;

export const Changed: Story = {};

export const Same: Story = {
  args: { newText: '# Names\n', oldText: '# Names\n' },
};
