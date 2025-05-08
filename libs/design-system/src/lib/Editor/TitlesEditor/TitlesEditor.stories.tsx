import { Meta, StoryObj } from '@storybook/react';
import { TitlesEditor } from './TitlesEditor';

const content = {
  type: 'titles',
  content: [
    {
      attrs: {
        level: 4,
        uuid: 'dc9c9b5f-5da1-4c74-881c-d1681725575a',
        language: 'en',
        type: 'eft:toh',
      },
      type: 'heading',
      content: [
        {
          type: 'text',
          text: 'Toh 826',
        },
      ],
    },
    // {
    //   type: 'mainTitles',
    //   attrs: {
    //     uuid: 'mainTitles',
    //   },
    //   content: [
    {
      attrs: {
        level: 1,
        uuid: '70643284-a2a9-4eca-bae9-6765a776e66c',
        language: 'en',
        type: 'eft:mainTitle',
      },
      type: 'enTitle',
      content: [
        {
          type: 'text',
          text: 'Verses of Auspiciousness',
        },
      ],
    },
    {
      attrs: {
        level: 2,
        uuid: '8dfd4ccd-5bec-4c98-8bea-b97f9b824036',
        language: 'boTitle',
        type: 'eft:mainTitle',
      },
      type: 'heading',
      content: [
        {
          type: 'text',
          text: 'བཀྲ་ཤིས་ཀྱི་ཚིགས་སུ་བཅད་པ།',
        },
      ],
    },
    {
      attrs: {
        level: 4,
        uuid: '2c486873-d4d3-4842-877c-560c2a996e04',
        language: 'Bo-Ltn',
        type: 'eft:mainTitle',
      },
      type: 'boLtnTitle',
      content: [
        {
          type: 'text',
          text: 'bkra shis kyi tshigs su bcad pa',
        },
      ],
    },
    {
      attrs: {
        level: 4,
        uuid: 'd3b241c5-4ca1-4c3f-8543-10797b5cadfc',
        language: 'Sa-Ltn',
        type: 'eft:mainTitle',
      },
      type: 'saLtnTitle',
      content: [
        {
          type: 'text',
          text: 'Maṅgalagāthā',
        },
      ],
    },
    //   ],
    // },
  ],
};

const meta: Meta<typeof TitlesEditor> = {
  component: TitlesEditor,
  title: 'Editor/TitlesEditor',
  tags: ['autodocs'],
};

type Story = StoryObj<typeof TitlesEditor>;

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
