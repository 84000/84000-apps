import { Meta, StoryObj } from '@storybook/react';
import { Title } from './Title';

const meta: Meta<typeof Title> = {
  title: 'Translation/Front Matter/Title',
  component: Title,
};

type Story = StoryObj<typeof Title>;

export const Primary: Story = {
  args: {
    children: 'A Translation Title',
  },
  argTypes: {
    children: { control: 'text' },
  },
};

export default meta;
