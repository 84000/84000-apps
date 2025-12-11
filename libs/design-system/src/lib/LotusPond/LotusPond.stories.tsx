import { Meta, StoryObj } from '@storybook/nextjs';
import { LotusPond } from './LotusPond';

const meta: Meta<typeof LotusPond> = {
  title: 'Core/LotusPond',
  component: LotusPond,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LotusPond>;

export const Default: Story = {};
