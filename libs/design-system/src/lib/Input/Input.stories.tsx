import { Meta, StoryObj } from '@storybook/nextjs';

import { Input } from './Input';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'Controls/Input',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  argTypes: {
    type: {
      options: ['color', 'date', 'email', 'file', 'number', 'password', 'text'],
      control: { type: 'select' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
  args: {
    type: 'text',
    disabled: false,
  },
};

export default meta;
