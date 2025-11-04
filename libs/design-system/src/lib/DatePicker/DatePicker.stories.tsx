import { Meta, StoryObj } from '@storybook/nextjs';
import { DatePicker } from './DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'Core/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  argTypes: {
    date: {
      control: { type: 'date' },
    },
  },
  args: {
    date: undefined,
  },
  render: (args) => <DatePicker {...args} />,
};

export default meta;
