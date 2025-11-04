import { Meta, StoryObj } from '@storybook/nextjs';

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
    width: 166,
    height: 100,
  },
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
  },
};
