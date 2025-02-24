import { Meta, StoryObj } from '@storybook/react';

import { Card } from './Card';
import { CardContent } from './CardContent';
import { CardDescription } from './CardDescription';
import { CardFooter } from './CardFooter';
import { CardHeader } from './CardHeader';
import { CardTitle } from './CardTitle';

const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Card/Card',
};

type Story = StoryObj<typeof Card>;

export const Primary: Story = {
  args: {
    title: 'Hello, this is a card',
    content: 'And this is the body of the card.',
    className: 'w-64',
  },
  render: ({ title, content, className }) => {
    return (
      <Card className={className}>
        <CardTitle>{title}</CardTitle>
        <CardContent>{content}</CardContent>
      </Card>
    );
  },
};

export const WithTitle: Story = {
  args: {
    title: 'This is a card title',
    className: 'w-64 h-32',
  },
  render: ({ title, className }) => {
    return (
      <Card className={className}>
        <CardTitle className="card-title">{title}</CardTitle>
      </Card>
    );
  },
};

export const WithHeader: Story = {
  args: {
    title: 'This is a card header',
    className: 'w-64 h-32',
  },
  render: ({ title, className }) => {
    return (
      <Card className={className}>
        <CardHeader className="card-title">{title}</CardHeader>
      </Card>
    );
  },
};

export const WithContent: Story = {
  args: {
    className: 'pt-4 w-64 h-32',
    content: 'This is an example of card content',
  },
  render: ({ content, className }) => {
    return (
      <Card className={className}>
        <CardContent>{content}</CardContent>
      </Card>
    );
  },
};

export const WithDescription: Story = {
  args: {
    className: 'w-64 h-32',
    content: 'This is an example of a card description',
  },
  render: ({ content, className }) => {
    return (
      <Card className={className}>
        <CardDescription>{content}</CardDescription>
      </Card>
    );
  },
};

export const WithFooter: Story = {
  args: {
    className: 'pt-6 w-64 h-32',
    content: 'This is an example of a card footer',
  },
  render: ({ content, className }) => {
    return (
      <Card className={className}>
        <CardFooter>{content}</CardFooter>
      </Card>
    );
  },
};

export default meta;
