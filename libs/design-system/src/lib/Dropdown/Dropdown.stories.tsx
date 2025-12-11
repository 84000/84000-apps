import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../Button/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './Dropdown';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Core/Dropdown',
  component: DropdownMenu,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: (_props) => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline">Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuItem>Team</DropdownMenuItem>
        <DropdownMenuItem>Subscription</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export default meta;
