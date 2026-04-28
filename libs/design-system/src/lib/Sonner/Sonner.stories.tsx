import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Toaster, toast } from './Sonner';
import { Button } from '../Button/Button';
import { ToasterProps } from 'sonner';

const meta: Meta<typeof Toaster> = {
  title: 'Core/Sonner',
  component: Toaster,
  tags: ['autodocs'],
};

export type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: (props: ToasterProps) => (
    <>
      <Button
        variant="outline"
        onClick={() =>
          toast('Event has been created.', {
            description: 'Sunday, December 03, 2023 at 9:00 AM',
            action: {
              label: 'Undo',
              onClick: () => console.log('Undo'),
            },
          })
        }
      >
        Show Toast
      </Button>
      <Toaster {...props} />
    </>
  ),
};

export const Variants: Story = {
  render: (props: ToasterProps) => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast('Default toast')}>
          Default
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.success('Success toast')}
        >
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.info('Info toast')}>
          Info
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.warning('Warning toast')}
        >
          Warning
        </Button>
        <Button variant="outline" onClick={() => toast.error('Error toast')}>
          Error
        </Button>
      </div>
      <Toaster {...props} />
    </>
  ),
};

export default meta;
