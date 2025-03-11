import { Meta, StoryObj } from '@storybook/react';

import { Surface } from './Surface';

const meta: Meta<typeof Surface> = {
  component: Surface,
  title: 'Core/Surface',
};

export type Story = StoryObj<typeof Surface>;

export const Default: Story = {
  argTypes: {
    withBorder: {
      control: { type: 'boolean' },
    },
    withShadow: {
      control: { type: 'boolean' },
    },
  },
  args: {
    withBorder: true,
    withShadow: true,
  },
  render: (args) => (
    <Surface {...args}>
      <h1>Surface</h1>
      <p>A surface is kind of like a card, but more general.</p>
    </Surface>
  ),
};

export default meta;
