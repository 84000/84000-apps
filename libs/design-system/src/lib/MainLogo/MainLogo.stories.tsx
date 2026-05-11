import { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MainLogo } from './MainLogo';

const meta: Meta<typeof MainLogo> = {
  component: MainLogo,
  title: 'Core/MainLogo',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MainLogo>;

export const Primary: Story = {
  args: {
    width: 247,
    height: 95,
    fill: '#004570',
  },
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
    fill: { control: 'color' },
  },
};
