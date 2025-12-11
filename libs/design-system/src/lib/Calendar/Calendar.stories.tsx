import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Calendar } from './Calendar';
import { DateRange, Modifiers } from 'react-day-picker';

const meta: Meta<typeof Calendar> = {
  title: 'Core/Calendar',
  component: Calendar,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Calendar>;

export const Single: Story = {
  argTypes: {
    mode: {
      options: ['single'],
      control: { type: 'select' },
    },
    selected: {
      control: { type: 'date' },
    },
    numberOfMonths: {
      control: { type: 'number' },
    },
    onSelect: {
      action: 'selected',
    },
    captionLayout: {
      options: ['label', 'dropdown', 'dropdown-months', 'dropdown-years'],
      control: { type: 'select' },
    },
    buttonVariant: {
      options: ['default', 'secondary', 'outline', 'ghost', 'link'],
      control: { type: 'select' },
    },
    showOutsideDays: {
      control: { type: 'boolean' },
    },
  },
  args: {
    mode: 'single',
    selected: new Date(),
    numberOfMonths: 1,
    captionLayout: 'label',
    buttonVariant: 'ghost',
    showOutsideDays: true,
    onSelect: (selected: Date, triggered: Date, modifiers: Modifiers) =>
      console.log(
        'Selected date:',
        selected,
        'Triggered by:',
        triggered,
        'Modifiers:',
        modifiers,
      ),
  },
  render: (args) => <Calendar {...args} className="rounded-md border" />,
};

export const Range: Story = {
  ...Single.argTypes,
  argTypes: {
    mode: {
      options: ['range'],
      control: { type: 'select' },
    },
    selected: {
      control: { type: 'object' },
    },
  },
  args: {
    mode: 'range',
    selected: {
      from: new Date(),
      to: new Date(new Date().getTime() + 86400000 * 28),
    },
    captionLayout: 'label',
    buttonVariant: 'ghost',
    numberOfMonths: 2,
    showOutsideDays: true,
    onSelect: (selected: DateRange, triggered: Date, modifiers: Modifiers) =>
      console.log('Selected range:', selected, triggered, modifiers),
  },
  render: (args) => <Calendar {...args} className="rounded-md border" />,
};

export const Multiple: Story = {
  argTypes: {
    ...Single.argTypes,
    mode: {
      options: ['multiple'],
      control: { type: 'select' },
    },
    selected: {
      control: { type: 'object' },
    },
  },
  args: {
    mode: 'multiple',
    selected: [new Date(), new Date(new Date().getTime() + 86400000 * 2)],
    captionLayout: 'label',
    buttonVariant: 'ghost',
    numberOfMonths: 1,
    showOutsideDays: true,
    onSelect: (selected: Date[], triggered: Date, modifiers: Modifiers) =>
      console.log('Selected dates:', selected, triggered, modifiers),
  },
  render: (args) => <Calendar {...args} className="rounded-md border" />,
};

export default meta;
