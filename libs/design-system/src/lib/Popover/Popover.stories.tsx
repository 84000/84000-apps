import { Meta, StoryObj } from '@storybook/react';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Button } from '../Button/Button';
import { TitleForm } from '../Translation/Title/TitleForm';

const meta: Meta<typeof Popover> = {
  title: 'Core/Popover',
  component: Popover,
};
type Story = StoryObj<typeof Popover>;

export const Primary: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-120">
        <div className="flex flex-col gap-6">
          <h4 className="font-medium leading-none">Edit Titles</h4>
          <TitleForm onChange={(title) => console.log(title)} titles={[]} />
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export default meta;
