import { Meta, StoryObj } from '@storybook/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './Tooltip';
import { Button } from '../Button/Button';

export function TooltipStory() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>A tip for you!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta: Meta<typeof TooltipStory> = {
  title: 'Core/Tooltip',
  component: TooltipStory,
};

export type Story = StoryObj<typeof TooltipStory>;

export const Default: Story = {};

export default meta;
