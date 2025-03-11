import { Meta, StoryObj } from '@storybook/react';

import { Icon } from './Icon';
import { icons } from 'lucide-react';

const meta: Meta<typeof Icon> = {
  component: Icon,
  title: 'Core/Icon',
};

export const Default: StoryObj<typeof Icon> = {
  argTypes: {
    name: {
      options: Object.keys(icons),
      control: { type: 'select' },
    },
    strokeWidth: {
      control: { type: 'number' },
    },
  },
  args: {
    name: 'ArrowRight',
    strokeWidth: 2.5,
  },
};

export default meta;
