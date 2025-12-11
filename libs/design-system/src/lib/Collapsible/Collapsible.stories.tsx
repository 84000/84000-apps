import { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './Collapsible';

const meta: Meta<typeof Collapsible> = {
  title: 'Core/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: (_args) => (
    <Collapsible>
      <CollapsibleTrigger>Trigger</CollapsibleTrigger>
      <CollapsibleContent>Content</CollapsibleContent>
    </Collapsible>
  ),
};

export default meta;
