import { Meta, StoryObj } from '@storybook/nextjs';
import { TitlesCard } from './TitlesCard';

const meta: Meta<typeof TitlesCard> = {
  title: 'Translation/Front Matter/TitlesCard',
  component: TitlesCard,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof TitlesCard>;

export const Primary: Story = {
  args: {
    header: 'Discipline',
    main: 'The Chapter on Going Forth',
    footer: 'Toh 1-1',
    canEdit: true,
    hasMore: true,
    onEdit() {
      console.log('Edit clicked');
    },
    onMore() {
      console.log('Card clicked');
    },
  },
  argTypes: {
    header: { control: 'text' },
    main: { control: 'text' },
    footer: { control: 'text' },
    canEdit: { control: 'boolean' },
    hasMore: { control: 'boolean' },
    onEdit: { control: false },
    onMore: { control: false },
  },
};

export default meta;
