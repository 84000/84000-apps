import { Meta, StoryObj } from '@storybook/nextjs';
import {
  DEFAULT_HOVER_CARD_CLOSE_DELAY,
  DEFAULT_HOVER_CARD_OPEN_DELAY,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './HoverCard';
import { Button } from '../Button/Button';

const meta: Meta<typeof HoverCard> = {
  title: 'Core/HoverCard',
  component: HoverCard,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof HoverCard>;

export const Default: Story = {
  argTypes: {
    openDelay: {
      control: { type: 'number', min: 0, max: 5000, step: 100 },
      description: 'Delay in milliseconds before the hover card opens',
      defaultValue: DEFAULT_HOVER_CARD_OPEN_DELAY,
    },
    closeDelay: {
      control: { type: 'number', min: 0, max: 5000, step: 100 },
      description: 'Delay in milliseconds before the hover card closes',
      defaultValue: DEFAULT_HOVER_CARD_CLOSE_DELAY,
    },
  },
  args: {
    openDelay: DEFAULT_HOVER_CARD_OPEN_DELAY,
    closeDelay: DEFAULT_HOVER_CARD_CLOSE_DELAY,
  },
  render: ({ openDelay, closeDelay }) => (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>
        <Button variant="link">Hover over me</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex flex-col gap-2">
          <h4 className="font-medium leading-none">Hover Card Title</h4>
          <p className="text-sm text-muted-foreground">
            This is some content inside the hover card. It appears when you
            hover over the trigger.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export default meta;
