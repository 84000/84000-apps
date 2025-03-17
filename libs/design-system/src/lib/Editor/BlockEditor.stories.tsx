import { Meta, StoryObj } from '@storybook/react';
import { BlockEditor } from './BlockEditor';

const content = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [
        {
          type: 'text',
          text: 'A heading',
        },
      ],
    },
    {
      type: 'translationTitle',
      content: [
        {
          type: 'text',
          text: 'A Translation Title',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'A line of text',
        },
      ],
    },
  ],
};

const meta: Meta<typeof BlockEditor> = {
  component: BlockEditor,
  title: 'Editor/BlockEditor',
};

type Story = StoryObj<typeof BlockEditor>;

export const Primary: Story = {
  args: {
    isEditable: true,
    content,
  },
  argTypes: {
    isEditable: { control: 'boolean' },
    content: { control: 'object' },
  },
};

export default meta;
