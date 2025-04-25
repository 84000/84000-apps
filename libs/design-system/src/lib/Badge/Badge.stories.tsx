import { Meta, StoryObj } from '@storybook/react';

import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'Core/Badge',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Badge>;

export const Primary: Story = {
  argTypes: {
    variant: {
      options: ['default', 'destructive', 'outline', 'secondary'],
      control: { type: 'select' },
    },
    asChild: {
      control: { type: 'boolean' },
    },
  },
  args: {
    variant: 'default',
    children: 'Badge',
    asChild: false,
  },
};

export default meta;
