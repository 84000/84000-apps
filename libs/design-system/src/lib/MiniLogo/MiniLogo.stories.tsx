import { Meta, StoryObj } from '@storybook/nextjs';

import { MiniLogo } from './MiniLogo';

const meta: Meta<typeof MiniLogo> = {
  component: MiniLogo,
  title: 'Core/MiniLogo',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MiniLogo>;

export const Primary: Story = {
  args: {
    width: 100,
    height: 100,
  },
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
  },
};
