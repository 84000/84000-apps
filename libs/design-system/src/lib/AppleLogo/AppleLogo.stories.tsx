import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AppleLogo } from './AppleLogo';

const meta: Meta<typeof AppleLogo> = {
  title: 'Core/AppleLogo',
  component: AppleLogo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AppleLogo>;

export const Default: Story = {
  args: {
    width: 100,
    height: 100,
  },
};
