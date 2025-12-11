import { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from '../Button/Button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './Sheet';

const meta: Meta<typeof Sheet> = {
  title: 'Layout/Sheet',
  component: Sheet,
  tags: ['autodocs'],
};

type StoryProps = {
  direction: 'top' | 'right' | 'bottom' | 'left';
};

export type Story = StoryObj<StoryProps>;

export const Default: Story = {
  argTypes: {
    direction: {
      options: ['top', 'right', 'bottom', 'left'],
      control: { type: 'radio' },
    },
  },
  args: {
    direction: 'left',
  },
  render: ({ direction }) => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from the {direction}</Button>
      </SheetTrigger>
      <SheetContent side={direction}>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>Sheet Description</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <h1>Hello.</h1>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">Footer Action</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export default meta;
