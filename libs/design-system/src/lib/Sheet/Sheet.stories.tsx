import { Meta, StoryObj } from '@storybook/react';

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

type SheetSide = 'top' | 'right' | 'bottom' | 'left';

function SheetStory({ direction }: { direction: SheetSide }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from the {direction}</Button>
      </SheetTrigger>
      <SheetContent side={direction}>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>Sheet Description</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <h1>Hello.</h1>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">Footer Action</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const meta: Meta<typeof SheetStory> = {
  title: 'Layout/Sheet',
  component: SheetStory,
};

export type Story = StoryObj<typeof SheetStory>;

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
};

export default meta;
