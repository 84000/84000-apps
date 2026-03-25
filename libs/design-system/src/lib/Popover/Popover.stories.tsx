import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Button } from '../Button/Button';

const meta: Meta<typeof Popover> = {
  title: 'Core/Popover',
  component: Popover,
  tags: ['autodocs'],
};
type Story = StoryObj<typeof Popover>;

export const Primary: Story = {
  render: (_props) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-120">
        <div className="flex flex-col gap-6">
          <h4 className="font-medium leading-none">Popover Content</h4>
          <p className="text-sm text-muted-foreground">
            Use this area for inline actions or small supporting forms.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export default meta;
