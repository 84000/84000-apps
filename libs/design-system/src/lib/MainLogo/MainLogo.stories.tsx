import { Meta, StoryObj } from '@storybook/react';

import { MainLogo } from './MainLogo';

const meta: Meta<typeof MainLogo> = {
  component: MainLogo,
  title: 'Core/MainLogo',
};
export default meta;
type Story = StoryObj<typeof MainLogo>;

export const Primary: Story = {
  args: {},
};
