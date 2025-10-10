import { Meta, StoryObj } from '@storybook/nextjs';
import { Titles } from './Titles';

const meta: Meta<typeof Titles> = {
  title: 'Translation/Front Matter/Titles',
  component: Titles,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof Titles>;

export const Primary: Story = {
  args: {
    variant: 'english',
    titles: [
      {
        uuid: '1',
        title: 'འཕགས་པ་ཆོས་བཞི་པ་ཞེས་བྱ་བ་ཐེག་པ་ཆེན་པོའི་མདོ།',
        language: 'bo',
        type: 'mainTitle',
      },
      {
        uuid: '2',
        title: 'The Noble Mahāyāna Sūtra on the Four Factors',
        language: 'en',
        type: 'mainTitle',
      },
      {
        uuid: '3',
        title: 'phags pa chos bzhi pa zhes bya ba theg pa chen po’i mdo',
        language: 'Bo-Ltn',
        type: 'mainTitle',
      },
      {
        uuid: '4',
        title: 'Ārya­catur­dharmaka­nāma­mahā­yāna­sūtra',
        language: 'Sa-Ltn',
        type: 'mainTitle',
      },
      {
        uuid: '5',
        title: 'Toh 251',
        language: 'en',
        type: 'toh',
      },
    ],
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['english', 'tibetan', 'comparison', 'other'],
    },
    titles: { control: false },
  },
};

export default meta;
