import { Meta, StoryObj } from '@storybook/react';
import { BlockEditor } from './BlockEditor';

const meta: Meta<typeof BlockEditor> = {
  component: BlockEditor,
  title: 'Editor/BlockEditor',
};

type Story = StoryObj<typeof BlockEditor>;

export const Primary: Story = {};

export default meta;
