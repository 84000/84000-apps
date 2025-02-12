import { Meta, StoryObj } from '@storybook/react';

import { IconSidebar } from './IconSidebar';

const meta: Meta<typeof IconSidebar> = {
  component: IconSidebar,
  title: 'Sidebar/IconSidebar',
};

export type Story = StoryObj<typeof IconSidebar>;

export const Primary: Story = {
  args: {
    icons: [
      {
        id: 1,
        icon: 'solar:layers-line-duotone',
        tooltip: 'Dashboards',
      },
      {
        id: 2,
        icon: 'solar:mirror-left-line-duotone',
        tooltip: 'Docs & Others',
      },
    ],
  },
};

export default meta;
