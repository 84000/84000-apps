import { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '../Button/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Core/Dialog',
  component: Dialog,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: (_props) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
        <p>This is the content of the dialog.</p>
      </DialogContent>
    </Dialog>
  ),
};

export default meta;
