import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TitlesCard } from './TitlesCard';

const meta: Meta<typeof TitlesCard> = {
  title: 'Translation/Front Matter/TitlesCard',
  component: TitlesCard,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof TitlesCard>;

export const Primary: Story = {
  args: {
    header: '༄༅།  །རབ་ཏུ་འབྱུང་བའི་གཞི།',
    main: 'The Chapter on Going Forth',
    footer: 'Pravrajyāvastu',
    toh: 'Toh 1-1',
    section: 'Chapters on Monastic Discipline',
    canEdit: true,
    onEdit() {
      console.log('Edit clicked');
    },
  },
  argTypes: {
    header: { control: 'text' },
    main: { control: 'text' },
    footer: { control: 'text' },
    toh: { control: 'text' },
    section: { control: 'text' },
    canEdit: { control: 'boolean' },
    onEdit: { control: false },
  },
};

export default meta;
