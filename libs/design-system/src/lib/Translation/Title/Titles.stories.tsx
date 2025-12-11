import { Meta, StoryObj } from '@storybook/nextjs-vite';
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
    canEdit: true,
    imprint: {
      toh: 'Toh 1-1',
      license: {
        link: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        name: 'CC BY-NC-ND',
        description:
          'This work is provided under the protection of a Creative Commons CC BY-NC-ND (Attribution - Non-commercial - No-derivatives) 3.0 copyright. It may be copied or printed for fair use, but only with full attribution, and not for commercial advantage or personal compensation. For full details, see the Creative Commons license.',
      },
      section: 'Chapters on Monastic Discipline',
      version: '1.37.20',
      uuid: '092e9a3c-12a6-4e1c-a05b-16835c0e62a8',
      longTitles: {
        bo: 'འདུལ་བ་གཞི་ལས། རབ་ཏུ་འབྱུང་བའི་གཞི།',
        en: '“The Chapter on Going Forth” from The Chapters on Monastic Discipline',
        'Bo-Ltn': '’dul ba gzhi las/ rab tu ’byung ba’i gzhi',
        'Sa-Ltn': 'Vinayavastu Pravrajyāvastu',
      },
      mainTitles: {
        bo: 'རབ་ཏུ་འབྱུང་བའི་གཞི།',
        en: 'The Chapter on Going Forth',
        'Bo-Ltn': 'rab tu ’byung ba’i gzhi',
        'Sa-Ltn': 'Pravrajyāvastu',
      },
      publishYear: '2018',
      tibetanAuthors:
        'Dharmākara, Palgyi Lhünpo, Paltsek, Sarvajñādeva, Vidyākaraprabha',
      sourceDescription: 'Degé Kangyur, vol. 1 (’dul ba, ka), folios 1.a–131.a',
      publisherStatement:
        '84000: Translating the Words of the Buddha is a global non-profit initiative to translate all the Buddha’s words into modern languages, and to make them available to everyone.',
      tibetanTranslators:
        'Dharmākara, Palgyi Lhünpo, Paltsek, Sarvajñādeva, Vidyākaraprabha',
    },
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
    variant: {
      control: 'radio',
      options: ['english', 'tibetan', 'comparison', 'other'],
    },
    canEdit: { control: 'boolean' },
    titles: { control: false },
  },
};

export default meta;
