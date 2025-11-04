import { Meta, StoryObj } from '@storybook/nextjs';

import { SaveButton } from './SaveButton';

const meta: Meta<typeof SaveButton> = {
  component: SaveButton,
  title: 'Controls/SaveButton',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof SaveButton>;

export const Primary: Story = {
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    onClick: {
      action: 'clicked',
      description: 'Function to call when the button is clicked',
    },
  },
  args: {
    disabled: false,
    onClick: async () => {
      // Simulate a save operation
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
  },
};

export default meta;
