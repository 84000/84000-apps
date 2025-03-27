import { Meta, StoryObj } from '@storybook/react';

import { Separator } from './Separator';

const meta: Meta<typeof Separator> = {
  component: Separator,
  title: 'Core/Separator',
  tags: ['autodocs'],
};

export type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  argTypes: {
    orientation: {
      options: ['horizontal', 'vertical'],
      control: { type: 'radio' },
    },
    decorative: {
      control: { type: 'boolean' },
    },
  },
  args: {
    orientation: 'horizontal',
    decorative: true,
  },
};

export default meta;
