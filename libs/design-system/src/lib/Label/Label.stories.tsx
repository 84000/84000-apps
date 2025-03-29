import { Meta, StoryObj } from '@storybook/react';
import { Label } from './Label';

const meta: Meta<typeof Label> = {
  title: 'Core/Label',
  component: Label,
  tags: ['autodocs'],
};

export type Story = StoryObj<typeof Label>;

export const Primary: Story = {
  args: {
    children: 'Label',
  },
};

export default meta;
