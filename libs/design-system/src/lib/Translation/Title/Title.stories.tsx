import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Title } from './Title';

const meta: Meta<typeof Title> = {
  title: 'Translation/Front Matter/Title',
  component: Title,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Title>;

export const Primary: Story = {
  args: {
    language: 'en',
    children: 'A Translation Title',
  },
  argTypes: {
    language: { control: 'radio', options: ['en', 'bo', 'Sa-Ltn', 'Bo-Ltn'] },
    children: { control: 'text' },
  },
};

export default meta;
