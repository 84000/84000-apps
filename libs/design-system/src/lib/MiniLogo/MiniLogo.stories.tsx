import { Meta, StoryObj } from '@storybook/react';

import { MiniLogo } from './MiniLogo';

const meta: Meta<typeof MiniLogo> = {
  component: MiniLogo,
  title: 'Core/MiniLogo',
};
export default meta;
type Story = StoryObj<typeof MiniLogo>;

export const Primary: Story = {
  args: {},
};
