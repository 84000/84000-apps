import { Meta, StoryObj } from '@storybook/react';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Controls/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
    variant: {
      control: 'select',
      options: ['default', 'outline'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Toggle>;
export const Default: Story = {
  args: {
    children: 'Toggle',
  },
};
