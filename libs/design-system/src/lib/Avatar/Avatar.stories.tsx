import { Meta, StoryObj } from '@storybook/nextjs';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Core/Avatar',
  component: Avatar,
  tags: ['autodocs'],
};

type AvatarImageProps = {
  image: string;
  fallback: string;
};

type Story = StoryObj<AvatarImageProps>;

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
  render: ({ image, fallback }) => (
    <Avatar>
      <AvatarImage src={image} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  ),
};
export default meta;
