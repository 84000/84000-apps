import { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Palette } from './Palette';

const meta: Meta<typeof Palette> = {
  title: 'Theme/Palette',
  component: Palette,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Palette>;

export const Default: Story = {};

export default meta;
