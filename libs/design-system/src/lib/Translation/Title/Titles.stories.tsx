import { Meta, StoryObj } from '@storybook/react';
import { Titles } from './Titles';

const meta: Meta<typeof Titles> = {
  title: 'Translation/Front Matter/Titles',
  component: Titles,
};

type Story = StoryObj<typeof Titles>;

export const Primary: Story = {
  args: {
    titles: [
      {
        uuid: '1',
        title: 'འཕགས་པ་ཆོས་བཞི་པ་ཞེས་བྱ་བ་ཐེག་པ་ཆེན་པོའི་མདོ།',
        language: 'bo',
      },
      {
        uuid: '2',
        title: 'The Noble Mahāyāna Sūtra on the Four Factors',
        language: 'en',
      },
      {
        uuid: '3',
        title: 'phags pa chos bzhi pa zhes bya ba theg pa chen po’i mdo',
        language: 'Bo-Ltn',
      },
      {
        uuid: '4',
        title: 'Ārya­catur­dharmaka­nāma­mahā­yāna­sūtra',
        language: 'Sa-Ltn',
      },
    ],
  },
};

export default meta;
