import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FramedCard } from './FramedCard';

const meta: Meta<typeof FramedCard> = {
  title: 'Translation/Front Matter/FramedCard',
  component: FramedCard,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof FramedCard>;

export const Primary: Story = {
  args: {
    children: (
      <div className="h-48 flex">
        <div className="m-auto text-center">
          This is a framed card. You can put any content you like here.
        </div>
      </div>
    ),
  },
  argTypes: {
    children: { control: false },
  },
};

export default meta;
