import { Meta, StoryObj } from '@storybook/react';
import { StageChip } from './StageChip';
import { TooltipProvider } from '../Tooltip/Tooltip';
import { PROJECT_STAGE_LABELS } from '@data-access';

const meta: Meta<typeof StageChip> = {
  title: 'Core/StageChip',
  component: StageChip,
  tags: ['autodocs'],
};

export type Story = StoryObj<typeof StageChip>;

export const Default: Story = {
  argTypes: {
    stage: {
      control: { type: 'select' },
      options: PROJECT_STAGE_LABELS,
      description: 'The label of the project stage',
      defaultValue: '2.a',
    },
  },
  args: {
    stage: '2.a',
  },
  render: ({ stage }) => (
    <TooltipProvider>
      <StageChip stage={stage} />
    </TooltipProvider>
  ),
};

export default meta;
