import { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Card } from './Card';
import { CardContent } from './CardContent';
import { CardDescription } from './CardDescription';
import { CardFooter } from './CardFooter';
import { CardHeader } from './CardHeader';
import { CardTitle } from './CardTitle';

const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Core/Card',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Card>;

export const Primary: Story = {
  render: (_props) => {
    return (
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card Content</p>
        </CardContent>
        <CardFooter>
          <p>Card Footer</p>
        </CardFooter>
      </Card>
    );
  },
};

export default meta;
