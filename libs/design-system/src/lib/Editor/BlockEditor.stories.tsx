import { Meta, StoryObj } from '@storybook/react';
import { BlockEditor } from './BlockEditor';

const content = {
  type: 'doc',
  content: [
    {
      sort: 136,
      type: 'translationHeader',
      uuid: '54a251d8-e074-4516-973b-b353bfe385ed',
      xmlId: 'UT22084-066-009-section-1',
      content: [
        {
          type: 'text',
          text: 'The Translation',
        },
      ],
      work_uuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    },
    {
      sort: 141,
      type: 'translation',
      uuid: '31a821e6-9a69-4950-a32d-52645ef0fbe5',
      xmlId: 'UT22084-066-009-26',
      content: [
        {
          type: 'text',
          text: 'Homage to all the buddhas and bodhisattvas!',
        },
      ],
      work_uuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    },
    {
      sort: 146,
      type: 'translation',
      uuid: '09d19c19-a9da-450b-be90-c517f106469b',
      xmlId: 'UT22084-066-009-226',
      content: [
        {
          type: 'text',
          text: 'Thus did I hear at one time. The Buddha was residing in Śrāvastī, in Jeta’s Grove, Anāthapiṇḍada’s park, together with a great community of monks, consisting of 1,250 monks, and a great assembly of bodhisattvas. At that time, the Blessed One addressed the monks:',
        },
      ],
      work_uuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
    },
    {
      sort: 151,
      type: 'translation',
      uuid: 'e2876129-3034-4bbe-a4fb-3049e38909ec',
      xmlId: 'UT22084-066-009-30',
      content: [
        {
          type: 'text',
          text: '“Monks, for as long as they live, bodhisattvas, great beings, should not abandon four factors even at the cost of their lives. What are these four?',
        },
      ],
      work_uuid: 'ef63eb47-f3e4-4d27-8d60-59e8411627a2',
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
