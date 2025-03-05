import { Meta, StoryObj } from '@storybook/react';

import { Skeleton } from './Skeleton';

export function SkeletonCard() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );
}

const meta: Meta<typeof SkeletonCard> = {
  title: 'Core/Skeleton',
  component: SkeletonCard,
};

export type Story = StoryObj<typeof SkeletonCard>;

export const Default: Story = {};

export default meta;
