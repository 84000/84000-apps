import { Meta, StoryObj } from '@storybook/react';

import { Skeleton } from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Core/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: (_props) => (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  ),
};

export default meta;
