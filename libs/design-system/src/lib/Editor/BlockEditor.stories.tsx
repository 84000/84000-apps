import { Meta, StoryObj } from '@storybook/react';
import { BlockEditor } from './BlockEditor';

const content = {
  type: 'doc',
  content: [
    {
      attrs: {
        level: 1,
        uuid: '54a251d8-e074-4516-973b-b353bfe385ed',
        class: 'passage',
        type: 'translationHeader',
        sort: 136,
      },
      type: 'heading',
      content: [
        {
          type: 'text',
          text: 'The Translation',
        },
      ],
    },
    {
      attrs: {
        uuid: '31a821e6-9a69-4950-a32d-52645ef0fbe5',
        class: 'passage',
        type: 'translation',
        sort: 141,
      },
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Homage to all the buddhas and bodhisattvas!',
          marks: [
            {
              type: 'bold',
            },
          ],
        },
      ],
    },
    {
      attrs: {
        uuid: '09d19c19-a9da-450b-be90-c517f106469b',
        class: 'passage',
        type: 'translation',
        sort: 146,
      },
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Thus did I hear at one time. The Buddha was residing in Śrāvastī, in Jeta’s Grove, Anāthapiṇḍada’s park, together with a great community of monks, consisting of 1,250 monks, and a great assembly of bodhisattvas. At that time, the Blessed One addressed the monks:',
        },
      ],
    },
    {
      attrs: {
        uuid: 'e2876129-3034-4bbe-a4fb-3049e38909ec',
        class: 'passage',
        type: 'translation',
        sort: 151,
      },
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon four factors even at the cost of their lives. What are these four?',
        },
      ],
    },
  ],
};

const meta: Meta<typeof BlockEditor> = {
  component: BlockEditor,
  title: 'Editor/BlockEditor',
  tags: ['autodocs'],
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
