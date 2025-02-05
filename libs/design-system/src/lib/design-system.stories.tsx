import { Meta, StoryObj } from '@storybook/react';

import { DesignSystem } from './design-system';

const meta: Meta<typeof DesignSystem> = {
  component: DesignSystem,
  title: 'DesignSystem',
};
export default meta;
type Story = StoryObj<typeof DesignSystem>;

export const Primary: Story = {
  args: {},
};
