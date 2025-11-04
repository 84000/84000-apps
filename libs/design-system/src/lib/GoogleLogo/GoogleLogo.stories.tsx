import { Meta, StoryObj } from '@storybook/nextjs';
import { GoogleLogo } from './GoogleLogo';

const meta: Meta<typeof GoogleLogo> = {
  title: 'Core/GoogleLogo',
  component: GoogleLogo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GoogleLogo>;

export const Default: Story = {
  args: {
    width: 100,
    height: 100,
  },
};
