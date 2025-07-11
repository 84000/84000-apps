import { Meta, StoryObj } from '@storybook/react';
import { EndNotesEditor } from './EndNotesEditor';

const content = {
  type: 'endNotes',
  content: [
    {
      type: 'passage',
      attrs: {
        uuid: '8dfd4ccd-5bec-4c98-8bea-b97f9b824036',
        class: 'passage',
        type: 'endNotesHeader',
        sort: 1,
        label: 'n.',
      },
      content: [
        {
          type: 'heading',
          attrs: {
            level: 2,
            uuid: '8dfd4ccd-5bec-4c98-8bea-b97f9b824036',
          },
          content: [
            {
              type: 'text',
              text: 'Notes',
            },
          ],
        },
      ],
    },
    {
      type: 'passage',
      attrs: {
        uuid: '70643284-a2a9-4eca-bae9-6765a776e66c',
        label: 'n.1',
      },
      content: [
        {
          type: 'endNote',
          content: [
            {
              type: 'text',
              text: 'This is a note.',
            },
          ],
        },
      ],
    },
  ],
};

const meta: Meta<typeof EndNotesEditor> = {
  component: EndNotesEditor,
  title: 'Editor/EndNotesEditor',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof EndNotesEditor>;

export const Primary: Story = {
  args: {
    content,
    isEditable: true,
  },
  argTypes: {
    content: {
      control: 'object',
      description: 'The content of the end notes editor, structured as JSON.',
    },
    isEditable: {
      control: 'boolean',
      description: 'Determines if the editor is in editable mode.',
    },
  },
};

export default meta;
