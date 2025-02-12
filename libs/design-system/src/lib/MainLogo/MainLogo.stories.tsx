import { Meta, StoryObj } from '@storybook/react';

import { FullLogo } from './MainLogo';

const meta: Meta<typeof FullLogo> = {
  component: FullLogo,
  title: 'Core/MainLogo',
};
export default meta;
type Story = StoryObj<typeof FullLogo>;

export const Primary: Story = {
  args: {},
};
