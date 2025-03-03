import { Meta, StoryObj } from '@storybook/react';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Core/Avatar',
  component: Avatar,
};

const AvatarStory = ({
  image,
  fallback,
}: {
  image: string;
  fallback: string;
}) => (
  <Avatar>
    <AvatarImage src={image} />
    <AvatarFallback>{fallback}</AvatarFallback>
  </Avatar>
);

type Story = StoryObj<typeof AvatarStory>;

export const Default: Story = {
  args: {
    image: 'https://github.com/shadcn.png',
    fallback: 'CN',
  },
  argTypes: {
    image: {
      control: 'text',
    },
    fallback: {
      control: 'text',
    },
  },
  render: (args) => <AvatarStory {...args} />,
};
export default meta;
