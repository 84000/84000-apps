import { Meta, StoryObj } from '@storybook/nextjs';
import { TitleForm } from './TitleForm';

const meta: Meta<typeof TitleForm> = {
  title: 'Translation/Front Matter/TitleForm',
  component: TitleForm,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof TitleForm>;

export const Primary: Story = {
  args: {
    titles: [],
    onChange(title) {
      console.log(title);
    },
  },
};

export default meta;
