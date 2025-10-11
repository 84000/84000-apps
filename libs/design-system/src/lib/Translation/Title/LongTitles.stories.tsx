import { Meta, StoryObj } from '@storybook/nextjs';
import { LongTitles } from './LongTitles';

const meta: Meta<typeof LongTitles> = {
  title: 'Translation/Front Matter/LongTitles',
  component: LongTitles,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof LongTitles>;

export const Primary: Story = {
  args: {
    titles: [
      {
        type: 'mainTitle',
        uuid: '94022f2e-6776-49ce-96f9-02ac9084fdcc',
        title: 'The Chapter on Going Forth',
        language: 'en',
      },
      {
        type: 'mainTitle',
        uuid: '23129196-34b7-4ccf-95ba-939a2501de46',
        title: 'Pravrajyāvastu',
        language: 'Sa-Ltn',
      },
      {
        type: 'mainTitle',
        uuid: '8c264329-04cc-4b8a-a7d2-d654ca092e75',
        title: 'རབ་ཏུ་འབྱུང་བའི་གཞི།',
        language: 'bo',
      },
      {
        type: 'mainTitle',
        uuid: 'aed7d1c1-f023-413a-98d6-3aaa8613a9f1',
        title: 'rab tu ’byung ba’i gzhi',
        language: 'Bo-Ltn',
      },
      {
        type: 'mainTitleOutsideCatalogueSection',
        uuid: '77c290a7-8e2b-401f-bd1e-d6f06e3ba33b',
        title: 'Chapters on Monastic Discipline, The Chapter on Going Forth',
        language: 'en',
      },
      {
        type: 'otherTitle',
        uuid: '5136fceb-57ab-4d7b-9fdd-4fe3c2d2e1d2',
        title: '《 律儀根本 》 之《出家根本》',
        language: 'zh',
      },
      {
        type: 'longTitle',
        uuid: '326df5e5-2ec1-4f06-b38d-c5692917f89f',
        title:
          '“The Chapter on Going Forth” from The Chapters on Monastic Discipline',
        language: 'en',
      },
      {
        type: 'longTitle',
        uuid: 'a00da2dc-8b71-442c-b6c3-8436a745ba10',
        title: 'Vinayavastu Pravrajyāvastu',
        language: 'Sa-Ltn',
      },
      {
        type: 'longTitle',
        uuid: 'fe4dc6e2-c298-4eb5-9737-4a2fc3c62050',
        title: 'འདུལ་བ་གཞི་ལས། རབ་ཏུ་འབྱུང་བའི་གཞི།',
        language: 'bo',
      },
      {
        type: 'longTitle',
        uuid: 'b1f30348-ad94-4a45-9c1e-75ecaeb61afb',
        title: '’dul ba gzhi las/ rab tu ’byung ba’i gzhi',
        language: 'Bo-Ltn',
      },
      {
        type: 'toh',
        uuid: 'f3ac624e-f345-45e4-9811-1ad9e134aa77',
        title: 'Toh 1-1',
        language: 'en',
      },
    ],
  },
  argTypes: {
    titles: { control: false },
  },
};

export default meta;
