import { Meta, StoryObj } from '@storybook/nextjs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './Tooltip';
import { Button } from '../Button/Button';

const meta: Meta<typeof Tooltip> = {
  title: 'Core/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
};

export type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: (_props) => (
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
  ),
};

export default meta;
