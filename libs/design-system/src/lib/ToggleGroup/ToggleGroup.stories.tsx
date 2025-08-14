import { Meta, StoryObj } from '@storybook/react';
import { ToggleGroup, ToggleGroupItem } from './ToggleGroup';

const meta: Meta<typeof ToggleGroup> = {
  title: 'Controls/ToggleGroup',
  component: ToggleGroup,
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
    type: {
      control: 'select',
      options: ['single', 'multiple'],
    },
    defaultValue: {
      control: 'text',
      description: 'Initial value for the toggle group',
    },
  },
};

export default meta;

type Story = StoryObj<typeof ToggleGroup>;
export const Default: Story = {
  render: (args) => <ToggleGroup {...args}>{args.children}</ToggleGroup>,
  args: {
    type: 'single',
    className: '',
    variant: 'default',
    size: 'default',
    defaultValue: 'center',
    children: (
      <>
        <ToggleGroupItem value="left">Left</ToggleGroupItem>
        <ToggleGroupItem value="center">Center</ToggleGroupItem>
        <ToggleGroupItem value="right">Right</ToggleGroupItem>
      </>
    ),
  },
};
