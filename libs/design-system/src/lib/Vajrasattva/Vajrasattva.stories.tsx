import { Meta, StoryObj } from '@storybook/nextjs';
import { Vajrasattva } from './Vajrasattva';

const meta: Meta<typeof Vajrasattva> = {
  title: 'Core/Varjrasattva',
  component: Vajrasattva,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Vajrasattva>;

export const Default: Story = {
  args: {
    width: 128,
    height: 128,
  },
};
