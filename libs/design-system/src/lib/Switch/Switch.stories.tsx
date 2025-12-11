import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  component: Switch,
  title: 'Controls/Switch',
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    defaultChecked: {
      control: { type: 'boolean' },
    },
    checked: {
      control: { type: 'boolean' },
    },
    onCheckedChange: {
      action: 'checkedChange',
      control: { type: undefined },
    },
  },
};

type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    defaultChecked: false,
    disabled: false,
    checked: false,
  },
};

export default meta;
