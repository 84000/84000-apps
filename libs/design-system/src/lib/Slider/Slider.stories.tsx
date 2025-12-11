import { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  component: Slider,
  title: 'Controls/Slider',
  tags: ['autodocs'],
  argTypes: {
    defaultValue: {
      control: { type: 'multi-select' },
    },
    max: {
      control: { type: 'number' },
    },
    min: {
      control: { type: 'number' },
    },
    step: {
      control: { type: 'number' },
    },
  },
};

type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    min: 0,
    step: 1,
  },
};

export const Range: Story = {
  args: {
    defaultValue: [25, 75],
    max: 100,
    min: 0,
    step: 1,
  },
};

export const CustomStep: Story = {
  args: {
    defaultValue: [50],
    max: 100,
    min: 0,
    step: 10,
  },
};

export default meta;
